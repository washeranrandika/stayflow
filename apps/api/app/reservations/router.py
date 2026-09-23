"""Reservations (bookings) router."""
import uuid
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from decimal import Decimal

from app.core.database import get_db
from app.core.dependencies import require_permission, CurrentUser
from app.core.permissions import Permission
from app.core.responses import success, paginated
from app.reservations.service import reservation_service

router = APIRouter()


class CreateReservationBody(BaseModel):
    property_id: uuid.UUID
    room_id: uuid.UUID
    primary_guest_id: uuid.UUID
    stay_type: str
    check_in_date: date
    check_in_time: Optional[str] = None
    expected_checkout_date: date
    expected_checkout_time: Optional[str] = None
    num_guests: int = 1
    booking_source: str = "WALK_IN"
    special_requests: Optional[str] = None
    notes: Optional[str] = None
    advance_payment: Decimal = Decimal("0")


class CancelReservationBody(BaseModel):
    reason: str


def _serialize(r):
    return {
        "id": str(r.id),
        "reservation_number": r.reservation_number,
        "property_id": str(r.property_id),
        "room_id": str(r.room_id),
        "room": {"id": str(r.room.id), "room_number": r.room.room_number, "status": r.room.status.value} if r.room else None,
        "primary_guest_id": str(r.primary_guest_id),
        "primary_guest": {"id": str(r.primary_guest.id), "full_name": r.primary_guest.full_name, "phone": r.primary_guest.phone} if r.primary_guest else None,
        "stay_type": r.stay_type.value,
        "check_in_date": r.check_in_date.isoformat(),
        "check_in_time": r.check_in_time,
        "expected_checkout_date": r.expected_checkout_date.isoformat(),
        "expected_checkout_time": r.expected_checkout_time,
        "num_guests": r.num_guests,
        "booking_source": r.booking_source.value,
        "status": r.status.value,
        "special_requests": r.special_requests,
        "notes": r.notes,
        "advance_payment": float(r.advance_payment),
        "created_at": r.created_at.isoformat(),
        "updated_at": r.updated_at.isoformat(),
    }


@router.get("", response_model=dict)
async def list_reservations(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    property_id: Optional[uuid.UUID] = Query(None),
    status: Optional[str] = Query(None),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    guest_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.BOOKING_VIEW)),
):
    reservations, total = await reservation_service.list_reservations(
        db, current_user.organization_id, property_id, status, from_date, to_date, guest_id, page, page_size
    )
    return paginated([_serialize(r) for r in reservations], page, page_size, total)


@router.post("", response_model=dict)
async def create_reservation(
    body: CreateReservationBody,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.BOOKING_CREATE)),
):
    res = await reservation_service.create(db, current_user.organization_id, current_user.user_id, body.model_dump())
    await db.commit()
    return success(data=_serialize(res), message="Reservation created")


@router.get("/{reservation_id}", response_model=dict)
async def get_reservation(
    reservation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.BOOKING_VIEW)),
):
    res = await reservation_service.get_by_id(db, reservation_id, current_user.organization_id)
    return success(data=_serialize(res))


@router.post("/{reservation_id}/cancel", response_model=dict)
async def cancel_reservation(
    reservation_id: uuid.UUID,
    body: CancelReservationBody,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.BOOKING_CANCEL)),
):
    res = await reservation_service.cancel(
        db, reservation_id, current_user.organization_id, current_user.user_id, body.reason
    )
    await db.commit()
    return success(data=_serialize(res), message="Reservation cancelled")
