"""Stays router."""
import uuid
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from datetime import datetime

from app.core.database import get_db
from app.core.dependencies import require_permission, CurrentUser
from app.core.permissions import Permission
from app.core.models import Stay, Property, Folio
from app.core.responses import success
from app.stays.service import stay_service

router = APIRouter()


class PricingEstimateBody(BaseModel):
    """Pre-check-in pricing estimate — no stay is created."""
    property_id: uuid.UUID
    room_id: uuid.UUID
    stay_type: str
    expected_checkout: datetime
    num_guests: int = 1



class CheckInBody(BaseModel):
    reservation_id: Optional[uuid.UUID] = None
    property_id: uuid.UUID
    room_id: uuid.UUID
    primary_guest_id: uuid.UUID
    stay_type: str
    expected_checkout: datetime
    num_guests: int = 1
    notes: Optional[str] = None


class DamageItem(BaseModel):
    description: str
    amount: Decimal
    notes: Optional[str] = None


class CheckoutBody(BaseModel):
    discount: Decimal = Decimal("0")
    notes: Optional[str] = None
    damage_items: Optional[list[DamageItem]] = None


class ExtendStayBody(BaseModel):
    expected_checkout: datetime
    notes: Optional[str] = None


def _serialize_stay(s):
    return {
        "id": str(s.id),
        "reservation_id": str(s.reservation_id) if s.reservation_id else None,
        "property_id": str(s.property_id),
        "property_name": s.property.name if getattr(s, "property", None) else None,
        "room_id": str(s.room_id),
        "room": {"id": str(s.room.id), "room_number": s.room.room_number, "max_guests": getattr(s.room, "max_guests", 2)} if s.room else None,
        "primary_guest_id": str(s.primary_guest_id),
        "primary_guest": {
            "id": str(s.primary_guest.id),
            "full_name": s.primary_guest.full_name,
            "phone": getattr(s.primary_guest, "phone", None),
            "email": getattr(s.primary_guest, "email", None),
            "notes": getattr(s.primary_guest, "notes", None),
        } if s.primary_guest else None,
        "stay_type": s.stay_type.value if hasattr(s.stay_type, "value") else str(s.stay_type),
        "actual_check_in": s.actual_check_in.isoformat(),
        "expected_checkout": s.expected_checkout.isoformat(),
        "actual_checkout": s.actual_checkout.isoformat() if s.actual_checkout else None,
        "num_guests": s.num_guests,
        "is_completed": s.is_completed,
        "notes": s.notes,
        "folio_id": str(s.folio.id) if s.folio else None,
        "folio": {
            "id": str(s.folio.id),
            "total": float(sum(item.total for item in s.folio.items)) if s.folio and s.folio.items else 0,
        } if s.folio else None,
        "created_at": s.created_at.isoformat(),
    }


@router.get("/active", response_model=dict)
async def list_active_stays(
    property_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.STAY_VIEW)),
):
    from sqlalchemy.orm import selectinload
    from app.core.models import Property, Folio
    query = (
        select(Stay)
        .join(Property, Stay.property_id == Property.id)
        .options(
            selectinload(Stay.property),
            selectinload(Stay.room),
            selectinload(Stay.primary_guest),
            selectinload(Stay.folio).selectinload(Folio.items),
        )
        .where(
            Property.organization_id == current_user.organization_id,
            Stay.is_completed == False,
        )
    )
    if property_id:
        query = query.where(Stay.property_id == property_id)

    result = await db.execute(query.order_by(Stay.actual_check_in.desc()))
    stays = result.scalars().all()
    return success(data=[_serialize_stay(s) for s in stays])


@router.post("/check-in", response_model=dict)
async def check_in(
    body: CheckInBody,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.STAY_CHECKIN)),
):
    stay = await stay_service.check_in(db, current_user.organization_id, current_user.user_id, body.model_dump())
    await db.commit()
    loaded_stay = await stay_service.get_by_id(db, stay.id, current_user.organization_id)
    return success(data=_serialize_stay(loaded_stay), message="Check-in successful")


@router.post("/pricing-estimate", response_model=dict)
async def pricing_estimate(
    body: PricingEstimateBody,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.STAY_VIEW)),
):
    """Return a pricing estimate for a prospective stay (no records created)."""
    from app.core.models import Room, RoomType, Property
    from app.pricing.engine import PricingInput, calculate_pricing
    from decimal import Decimal
    from datetime import datetime, timezone

    # Load room → room_type (with tenant check)
    result = await db.execute(
        select(Room)
        .join(Property, Room.property_id == Property.id)
        .options(selectinload(Room.room_type))
        .where(Room.id == body.room_id, Property.organization_id == current_user.organization_id)
    )
    room = result.scalar_one_or_none()
    if not room or not room.room_type:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Room not found")

    rt = room.room_type
    now = datetime.now(timezone.utc)

    pricing_input = PricingInput(
        stay_type=body.stay_type,
        actual_check_in=now,
        expected_checkout=body.expected_checkout,
        actual_checkout=body.expected_checkout,  # estimate: no overtime
        num_guests=body.num_guests,
        max_guests_included=rt.max_guests or 2,
        base_hourly_rate=Decimal(str(rt.base_hourly_rate or 0)),
        base_day_use_rate=Decimal(str(rt.base_day_use_rate or 0)),
        base_nightly_rate=Decimal(str(rt.base_nightly_rate or 0)),
        base_daily_rate=Decimal(str(rt.base_daily_rate or 0)),
        extra_hour_rate=Decimal(str(rt.extra_hour_rate or 0)),
        extra_guest_rate=Decimal(str(rt.extra_guest_rate or 0)),
        tax_rate=Decimal("0"),
        service_charge_rate=Decimal("0"),
    )

    r = calculate_pricing(pricing_input)
    return success(data={
        "room_charge": float(r.room_charge),
        "extra_hour_charge": float(r.extra_hour_charge),
        "extra_guest_charge": float(r.extra_guest_charge),
        "services_total": float(r.services_total),
        "service_charge": float(r.service_charge),
        "discount": float(r.discount),
        "tax_amount": float(r.tax),
        "subtotal": float(r.subtotal),
        "grand_total": float(r.grand_total),
        "breakdown": [
            {"label": b.label, "amount": float(b.amount), "is_deduction": b.is_deduction}
            for b in r.breakdown
        ],
    })


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
    damage_list = [d.model_dump() for d in body.damage_items] if body.damage_items else None
    result = await stay_service.checkout(
        db,
        stay_id,
        current_user.organization_id,
        current_user.user_id,
        discount=body.discount,
        notes=body.notes,
        damage_items=damage_list,
    )
    await db.commit()
    return success(data=result, message="Checkout completed")


@router.patch("/{stay_id}/extend", response_model=dict)
async def extend_stay(
    stay_id: uuid.UUID,
    body: ExtendStayBody,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.STAY_CHECKIN)),
):
    """Extend stay duration with a new expected checkout datetime."""
    stay = await stay_service.extend_stay(
        db,
        stay_id,
        current_user.organization_id,
        current_user.user_id,
        new_expected_checkout=body.expected_checkout,
        notes=body.notes,
    )
    await db.commit()
    return success(data=_serialize_stay(stay), message="Stay extended successfully")
