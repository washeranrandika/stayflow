"""Stays router."""
import uuid
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from datetime import datetime

from app.core.database import get_db
from app.core.dependencies import require_permission, CurrentUser
from app.core.permissions import Permission
from app.core.responses import success
from app.stays.service import stay_service

router = APIRouter()


class CheckInBody(BaseModel):
    reservation_id: Optional[uuid.UUID] = None
    property_id: uuid.UUID
    room_id: uuid.UUID
    primary_guest_id: uuid.UUID
    stay_type: str
    expected_checkout: datetime
    num_guests: int = 1
    notes: Optional[str] = None


class CheckoutBody(BaseModel):
    discount: Decimal = Decimal("0")
    notes: Optional[str] = None


def _serialize_stay(s):
    return {
        "id": str(s.id),
        "reservation_id": str(s.reservation_id) if s.reservation_id else None,
        "property_id": str(s.property_id),
        "room_id": str(s.room_id),
        "room": {"id": str(s.room.id), "room_number": s.room.room_number} if s.room else None,
        "primary_guest_id": str(s.primary_guest_id),
        "primary_guest": {"id": str(s.primary_guest.id), "full_name": s.primary_guest.full_name} if s.primary_guest else None,
        "stay_type": s.stay_type.value,
        "actual_check_in": s.actual_check_in.isoformat(),
        "expected_checkout": s.expected_checkout.isoformat(),
        "actual_checkout": s.actual_checkout.isoformat() if s.actual_checkout else None,
        "num_guests": s.num_guests,
        "is_completed": s.is_completed,
        "created_at": s.created_at.isoformat(),
    }


@router.post("/check-in", response_model=dict)
async def check_in(
    body: CheckInBody,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.STAY_CHECKIN)),
):
    stay = await stay_service.check_in(db, current_user.organization_id, current_user.user_id, body.model_dump())
    await db.commit()
    return success(data=_serialize_stay(stay), message="Check-in successful")


@router.get("/{stay_id}", response_model=dict)
async def get_stay(
    stay_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.STAY_VIEW)),
):
    stay = await stay_service.get_by_id(db, stay_id, current_user.organization_id)
    return success(data=_serialize_stay(stay))


@router.get("/{stay_id}/pricing", response_model=dict)
async def get_stay_pricing(
    stay_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.STAY_VIEW)),
):
    """Get current pricing estimate for an active stay."""
    stay = await stay_service.get_by_id(db, stay_id, current_user.organization_id)
    pricing = await stay_service.get_pricing_estimate(db, stay)
    return success(data=pricing)


@router.post("/{stay_id}/checkout", response_model=dict)
async def checkout(
    stay_id: uuid.UUID,
    body: CheckoutBody,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.STAY_CHECKOUT)),
):
    result = await stay_service.checkout(
        db, stay_id, current_user.organization_id, current_user.user_id, body.discount
    )
    await db.commit()
    return success(data=result, message="Checkout completed")
