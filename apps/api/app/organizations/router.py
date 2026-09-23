"""Organizations router."""
import uuid
import re
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_permission, CurrentUser, get_current_user_raw
from app.core.permissions import Permission
from app.core.models import Organization, OrganizationMember, User, UserRoleEnum
from app.core.responses import success
from app.core.security import hash_password
from app.audit.service import audit_log

router = APIRouter()


class CreateOrganizationBody(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    timezone: str = "UTC"
    currency: str = "USD"


class InviteMemberBody(BaseModel):
    email: str
    full_name: str
    password: str
    role: str  # OWNER, MANAGER, RECEPTIONIST, HOUSEKEEPER
    property_id: Optional[str] = None


class UpdateMemberBody(BaseModel):
    role: Optional[str] = None
    property_id: Optional[str] = None
    is_active: Optional[bool] = None


def _make_slug(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return f"{slug}-{uuid.uuid4().hex[:6]}"


@router.post("", response_model=dict)
async def create_organization(
    body: CreateOrganizationBody,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_raw),
):
    """Create a new organization. The calling user becomes OWNER."""
    org = Organization(
        name=body.name,
        slug=_make_slug(body.name),
        email=body.email,
        phone=body.phone,
        timezone=body.timezone,
        currency=body.currency,
    )
    db.add(org)
    await db.flush()

    member = OrganizationMember(
        organization_id=org.id,
        user_id=user.id,
        role=UserRoleEnum.OWNER,
    )
    db.add(member)
    await audit_log(db, "org.create", "organization", str(org.id), org.id, user.id, new_values={"name": body.name})
    await db.commit()

    return success(data={
        "id": str(org.id),
        "name": org.name,
        "slug": org.slug,
        "timezone": org.timezone,
        "currency": org.currency,
    }, message="Organization created")


@router.get("/me", response_model=dict)
async def get_my_organization(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    org = current_user.organization
    return success(data={
        "id": str(org.id),
        "name": org.name,
        "slug": org.slug,
        "email": org.email,
        "phone": org.phone,
        "timezone": org.timezone,
        "currency": org.currency,
        "is_active": org.is_active,
    })


@router.post("/members", response_model=dict)
async def invite_member(
    body: InviteMemberBody,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.STAFF_MANAGE)),
):
    """Add a new staff member to the organization."""
    # Find or create user
    result = await db.execute(select(User).where(User.email == body.email.lower()))
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            email=body.email.lower(),
            full_name=body.full_name,
            hashed_password=hash_password(body.password),
        )
        db.add(user)
        await db.flush()

    # Check not already a member
    result = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.organization_id == current_user.organization_id,
            OrganizationMember.user_id == user.id,
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail={"code": "ALREADY_MEMBER", "message": "User is already a member"})

    assigned_prop_id = None
    if body.property_id and str(body.property_id).strip() not in ("", "all", "none", "null"):
        try:
            assigned_prop_id = uuid.UUID(str(body.property_id).strip())
        except ValueError:
            assigned_prop_id = None

    member = OrganizationMember(
        organization_id=current_user.organization_id,
        user_id=user.id,
        role=UserRoleEnum(body.role),
        property_id=assigned_prop_id,
    )
    db.add(member)
    await audit_log(db, "staff.invite", "organization_member", str(member.id),
                   current_user.organization_id, current_user.user_id,
                   new_values={"email": body.email, "role": body.role, "property_id": str(assigned_prop_id) if assigned_prop_id else None})
    await db.commit()
    return success(data={"user_id": str(user.id), "role": body.role, "property_id": str(assigned_prop_id) if assigned_prop_id else None}, message="Staff member added")


@router.patch("/members/{member_id}", response_model=dict)
async def update_member(
    member_id: uuid.UUID,
    body: UpdateMemberBody,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.STAFF_MANAGE)),
):
    """Update staff member role, assigned property, or status."""
    result = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.id == member_id,
            OrganizationMember.organization_id == current_user.organization_id,
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    if body.role is not None:
        member.role = UserRoleEnum(body.role)
    if "property_id" in body.model_fields_set:
        if body.property_id is not None and str(body.property_id).strip() not in ("", "all", "none", "null"):
            try:
                member.property_id = uuid.UUID(str(body.property_id).strip())
            except ValueError:
                member.property_id = None
        else:
            member.property_id = None
    if body.is_active is not None:
        member.is_active = body.is_active

    await audit_log(
        db, "staff.update", "organization_member", str(member.id),
        current_user.organization_id, current_user.user_id,
        new_values={
            "role": member.role.value if member.role else None,
            "property_id": str(member.property_id) if member.property_id else None,
            "is_active": member.is_active,
        }
    )

    await db.commit()
    return success(message="Staff member updated")


@router.get("/members", response_model=dict)
async def list_members(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.STAFF_MANAGE)),
):
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(OrganizationMember)
        .options(selectinload(OrganizationMember.user), selectinload(OrganizationMember.property))
        .where(OrganizationMember.organization_id == current_user.organization_id)
        .order_by(OrganizationMember.created_at.desc())
    )
    members = result.scalars().all()
    return success(data=[{
        "member_id": str(m.id),
        "user_id": str(m.user_id),
        "email": m.user.email if m.user else "",
        "full_name": m.user.full_name if m.user else "Staff Member",
        "role": m.role.value,
        "property_id": str(m.property_id) if m.property_id else None,
        "property_name": m.property.name if m.property else "All Properties",
        "is_active": m.is_active,
        "joined_at": m.created_at.isoformat(),
    } for m in members])
