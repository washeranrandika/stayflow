"""Guests router."""
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func
from sqlalchemy.orm import selectinload
from pydantic import BaseModel

from app.core.database import get_db
from app.core.dependencies import require_permission, CurrentUser
from app.core.permissions import Permission
from app.core.models import Guest, Reservation, Stay, UserRoleEnum
from app.core.responses import success, paginated
from app.core.exceptions import TenantViolationError
from app.audit.service import audit_log

router = APIRouter()


class CreateGuestBody(BaseModel):
    full_name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    date_of_birth: Optional[str] = None
    address: Optional[str] = None
    preferred_language: Optional[str] = None
    notes: Optional[str] = None


class UpdateGuestBody(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    date_of_birth: Optional[str] = None
    address: Optional[str] = None
    preferred_language: Optional[str] = None
    notes: Optional[str] = None


def _serialize(g):
    return {
        "id": str(g.id),
        "organization_id": str(g.organization_id),
        "full_name": g.full_name,
        "phone": g.phone,
        "email": g.email,
        "date_of_birth": g.date_of_birth.isoformat() if g.date_of_birth else None,
        "address": g.address,
        "preferred_language": g.preferred_language,
        "notes": g.notes,
        "blacklisted": g.blacklisted,
        "created_at": g.created_at.isoformat(),
        "updated_at": g.updated_at.isoformat(),
    }


@router.get("", response_model=dict)
async def list_guests(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None, description="Search by name, phone, or email"),
    property_id: Optional[uuid.UUID] = Query(None, description="Filter guests by property"),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.GUEST_VIEW)),
):
    query = select(Guest).where(Guest.organization_id == current_user.organization_id)

    effective_property_id = property_id
    if not effective_property_id and current_user.role in [UserRoleEnum.RECEPTIONIST, UserRoleEnum.HOUSEKEEPER]:
        effective_property_id = current_user.property_id

    if effective_property_id:
        query = query.where(
            or_(
                Guest.reservations.any(Reservation.property_id == effective_property_id),
                Guest.stays.any(Stay.property_id == effective_property_id),
            )
        )

    if search:
        q = f"%{search}%"
        query = query.where(
            or_(
                Guest.full_name.ilike(q),
                Guest.phone.ilike(q),
                Guest.email.ilike(q),
                Guest.notes.ilike(q),
                Guest.address.ilike(q),
            )
        )

    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar_one()

    query = query.order_by(Guest.full_name).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    guests = result.scalars().all()
    return paginated([_serialize(g) for g in guests], page, page_size, total)


@router.post("", response_model=dict)
async def create_guest(
    body: CreateGuestBody,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.GUEST_CREATE)),
):
    guest = Guest(organization_id=current_user.organization_id, **body.model_dump(exclude_none=True))
    db.add(guest)
    await db.flush()
    await audit_log(db, "guest.create", "guest", str(guest.id), current_user.organization_id, current_user.user_id,
                   new_values={"full_name": guest.full_name})
    await db.commit()
    return success(data=_serialize(guest), message="Guest created")


@router.get("/{guest_id}", response_model=dict)
async def get_guest(
    guest_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.GUEST_VIEW)),
):
    result = await db.execute(
        select(Guest).where(Guest.id == guest_id, Guest.organization_id == current_user.organization_id)
    )
    guest = result.scalar_one_or_none()
    if not guest:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail={"code": "GUEST_NOT_FOUND", "message": "Guest not found"})
    return success(data=_serialize(guest))


@router.patch("/{guest_id}", response_model=dict)
async def update_guest(
    guest_id: uuid.UUID,
    body: UpdateGuestBody,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.GUEST_UPDATE)),
):
    result = await db.execute(
        select(Guest).where(Guest.id == guest_id, Guest.organization_id == current_user.organization_id)
    )
    guest = result.scalar_one_or_none()
    if not guest:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail={"code": "GUEST_NOT_FOUND", "message": "Guest not found"})

    old = {}
    for k, v in body.model_dump(exclude_none=True).items():
        old[k] = getattr(guest, k)
        setattr(guest, k, v)

    await audit_log(db, "guest.update", "guest", str(guest_id), current_user.organization_id, current_user.user_id,
                   old_values=old, new_values=body.model_dump(exclude_none=True))
    await db.commit()
    return success(data=_serialize(guest), message="Guest updated")


@router.get("/{guest_id}/history", response_model=dict)
async def get_guest_history(
    guest_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.GUEST_VIEW)),
):
    result = await db.execute(
        select(Guest).where(Guest.id == guest_id, Guest.organization_id == current_user.organization_id)
    )
    if not result.scalar_one_or_none():
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail={"code": "GUEST_NOT_FOUND", "message": "Guest not found"})

    res_result = await db.execute(
        select(Reservation).where(Reservation.primary_guest_id == guest_id).order_by(Reservation.created_at.desc())
    )
    reservations = res_result.scalars().all()

    stay_result = await db.execute(
        select(Stay).where(Stay.primary_guest_id == guest_id).order_by(Stay.actual_check_in.desc())
    )
    stays = stay_result.scalars().all()

    return success(data={
        "reservations": [{"id": str(r.id), "reservation_number": r.reservation_number, "status": r.status.value, "check_in_date": r.check_in_date.isoformat()} for r in reservations],
        "stays": [{"id": str(s.id), "stay_type": s.stay_type.value, "actual_check_in": s.actual_check_in.isoformat(), "is_completed": s.is_completed} for s in stays],
    })
