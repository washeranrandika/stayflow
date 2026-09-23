"""Reports router — revenue, occupancy, payments."""
from datetime import date, datetime, timedelta
from typing import Optional
import uuid
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.core.database import get_db
from app.core.dependencies import require_permission, CurrentUser
from app.core.permissions import Permission
from app.core.models import (
    Invoice, Payment, Stay, Room, Property, Reservation,
    ReservationStatusEnum, PaymentMethodEnum,
)
from app.core.responses import success

router = APIRouter()


@router.get("/revenue", response_model=dict)
async def revenue_report(
    from_date: date = Query(...),
    to_date: date = Query(...),
    property_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.REPORT_VIEW)),
):
    """Daily revenue report with payment method breakdown."""
    # Base query: finalized invoices in date range
    query = (
        select(func.sum(Invoice.grand_total), func.sum(Invoice.room_charge), func.sum(Invoice.services_total), func.count())
        .join(Stay, Invoice.stay_id == Stay.id)
        .join(Property, Stay.property_id == Property.id)
        .where(
            Property.organization_id == current_user.organization_id,
            Invoice.is_finalized == True,
            func.date(Invoice.finalized_at) >= from_date,
            func.date(Invoice.finalized_at) <= to_date,
        )
    )
    if property_id:
        query = query.where(Stay.property_id == property_id)

    result = await db.execute(query)
    row = result.one()
    total_revenue = float(row[0] or 0)
    room_revenue = float(row[1] or 0)
    service_revenue = float(row[2] or 0)
    total_stays = row[3]

    # Payment method breakdown
    pm_query = (
        select(Payment.payment_method, func.sum(Payment.amount))
        .join(Invoice, Payment.invoice_id == Invoice.id)
        .join(Stay, Invoice.stay_id == Stay.id)
        .join(Property, Stay.property_id == Property.id)
        .where(
            Property.organization_id == current_user.organization_id,
            func.date(Payment.created_at) >= from_date,
            func.date(Payment.created_at) <= to_date,
        )
        .group_by(Payment.payment_method)
    )
    if property_id:
        pm_query = pm_query.where(Stay.property_id == property_id)

    pm_result = await db.execute(pm_query)
    payments_by_method = {row[0].value: float(row[1]) for row in pm_result.all()}

    # Occupancy rate
    room_count_query = select(func.count(Room.id)).join(Property, Room.property_id == Property.id).where(
        Property.organization_id == current_user.organization_id, Room.is_active == True
    )
    if property_id:
        room_count_query = room_count_query.where(Room.property_id == property_id)
    total_rooms = (await db.execute(room_count_query)).scalar_one()

    total_days = (to_date - from_date).days + 1
    total_room_nights = total_rooms * total_days
    occupancy_rate = (total_stays / total_room_nights * 100) if total_room_nights > 0 else 0

    return success(data={
        "period": {"from": from_date.isoformat(), "to": to_date.isoformat()},
        "total_revenue": total_revenue,
        "room_revenue": room_revenue,
        "service_revenue": service_revenue,
        "total_stays": total_stays,
        "occupancy_rate": round(occupancy_rate, 2),
        "payments_by_method": payments_by_method,
    })


@router.get("/occupancy", response_model=dict)
async def occupancy_report(
    from_date: date = Query(...),
    to_date: date = Query(...),
    property_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.REPORT_VIEW)),
):
    query = (
        select(func.count(Stay.id))
        .join(Property, Stay.property_id == Property.id)
        .where(
            Property.organization_id == current_user.organization_id,
            func.date(Stay.actual_check_in) >= from_date,
            func.date(Stay.actual_check_in) <= to_date,
        )
    )
    if property_id:
        query = query.where(Stay.property_id == property_id)
    total_stays = (await db.execute(query)).scalar_one()

    room_query = select(func.count(Room.id)).join(Property, Room.property_id == Property.id).where(
        Property.organization_id == current_user.organization_id, Room.is_active == True
    )
    if property_id:
        room_query = room_query.where(Room.property_id == property_id)
    total_rooms = (await db.execute(room_query)).scalar_one()

    total_days = (to_date - from_date).days + 1
    total_room_nights = total_rooms * total_days
    occupancy_rate = (total_stays / total_room_nights * 100) if total_room_nights > 0 else 0

    return success(data={
        "period": {"from": from_date.isoformat(), "to": to_date.isoformat()},
        "total_rooms": total_rooms,
        "total_stays": total_stays,
        "total_room_nights": total_room_nights,
        "occupancy_rate": round(occupancy_rate, 2),
    })


@router.get("/payments", response_model=dict)
async def payment_report(
    from_date: date = Query(...),
    to_date: date = Query(...),
    property_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.REPORT_VIEW)),
):
    query = (
        select(func.sum(Payment.amount), func.count(Payment.id))
        .join(Invoice, Payment.invoice_id == Invoice.id)
        .join(Stay, Invoice.stay_id == Stay.id)
        .join(Property, Stay.property_id == Property.id)
        .where(
            Property.organization_id == current_user.organization_id,
            func.date(Payment.created_at) >= from_date,
            func.date(Payment.created_at) <= to_date,
        )
    )
    if property_id:
        query = query.where(Stay.property_id == property_id)

    result = await db.execute(query)
    row = result.one()
    return success(data={
        "period": {"from": from_date.isoformat(), "to": to_date.isoformat()},
        "total_payments": float(row[0] or 0),
        "payment_count": row[1],
    })


@router.get("/dashboard", response_model=dict)
async def dashboard_stats(
    property_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.REPORT_VIEW)),
):
    """Get real-time dashboard statistics."""
    from app.core.models import RoomStatusEnum
    today = date.today()

    # Room status counts
    room_q = (
        select(Room.status, func.count())
        .join(Property, Room.property_id == Property.id)
        .where(Property.organization_id == current_user.organization_id, Room.is_active == True)
        .group_by(Room.status)
    )
    if property_id:
        room_q = room_q.where(Room.property_id == property_id)
    room_counts = dict((await db.execute(room_q)).all())

    # Today's check-ins/outs
    checkin_q = (
        select(func.count(Stay.id))
        .join(Property, Stay.property_id == Property.id)
        .where(
            Property.organization_id == current_user.organization_id,
            func.date(Stay.actual_check_in) == today,
        )
    )
    todays_checkins = (await db.execute(checkin_q)).scalar_one()

    checkout_q = (
        select(func.count(Stay.id))
        .join(Property, Stay.property_id == Property.id)
        .where(
            Property.organization_id == current_user.organization_id,
            func.date(Stay.actual_checkout) == today,
            Stay.is_completed == True,
        )
    )
    todays_checkouts = (await db.execute(checkout_q)).scalar_one()

    # Today's revenue
    revenue_q = (
        select(func.sum(Invoice.grand_total))
        .join(Stay, Invoice.stay_id == Stay.id)
        .join(Property, Stay.property_id == Property.id)
        .where(
            Property.organization_id == current_user.organization_id,
            Invoice.is_finalized == True,
            func.date(Invoice.finalized_at) == today,
        )
    )
    todays_revenue = float((await db.execute(revenue_q)).scalar_one() or 0)

    return success(data={
        "room_status": {status.value: count for status, count in room_counts.items()},
        "todays_check_ins": todays_checkins,
        "todays_check_outs": todays_checkouts,
        "todays_revenue": todays_revenue,
    })
