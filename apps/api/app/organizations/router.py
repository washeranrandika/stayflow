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

    member = OrganizationMember(
        organization_id=current_user.organization_id,
        user_id=user.id,
        role=UserRoleEnum(body.role),
    )
    db.add(member)
    await audit_log(db, "staff.invite", "organization_member", str(member.id),
                   current_user.organization_id, current_user.user_id,
                   new_values={"email": body.email, "role": body.role})
    await db.commit()
    return success(data={"user_id": str(user.id), "role": body.role}, message="Staff member added")


@router.get("/members", response_model=dict)
async def list_members(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.STAFF_MANAGE)),
):
    result = await db.execute(
        select(OrganizationMember, User)
        .join(User, OrganizationMember.user_id == User.id)
        .where(OrganizationMember.organization_id == current_user.organization_id)
    )
    rows = result.all()
    return success(data=[{
        "member_id": str(m.id),
        "user_id": str(u.id),
        "email": u.email,
        "full_name": u.full_name,
        "role": m.role.value,
        "is_active": m.is_active,
        "joined_at": m.created_at.isoformat(),
    } for m, u in rows])
