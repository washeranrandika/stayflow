"""Reports router — revenue, occupancy, payments, and real-time manager analytics."""
from datetime import date, datetime, timedelta
from typing import Optional, List, Dict, Any
import uuid
from decimal import Decimal
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, desc
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import require_permission, CurrentUser
from app.core.permissions import Permission
from app.core.models import (
    Invoice, Payment, Stay, Room, Property, Reservation, Guest,
    ReservationStatusEnum, PaymentMethodEnum, RoomStatusEnum, Folio, FolioItem
)
from app.core.responses import success

router = APIRouter()


@router.get("/revenue", response_model=dict)
async def revenue_report(
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    property_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.REPORT_VIEW)),
):
    """
    Comprehensive revenue report including:
    - Period revenue (total, room, service)
    - Today's & this month's revenue
    - ADR (Average Daily Rate) and RevPAR
    - Payment channel breakdown
    - Recent transactions list
    """
    today = date.today()
    if not to_date:
        to_date = today
    if not from_date:
        from_date = to_date - timedelta(days=30)

    # 1. Period Invoices & Revenue
    inv_query = (
        select(
            func.coalesce(func.sum(Invoice.grand_total), 0),
            func.coalesce(func.sum(Invoice.room_charge), 0),
            func.coalesce(func.sum(Invoice.services_total), 0),
            func.count(Invoice.id),
        )
        .join(Stay, Invoice.stay_id == Stay.id)
        .join(Property, Stay.property_id == Property.id)
        .where(
            Property.organization_id == current_user.organization_id,
            func.date(Invoice.created_at) >= from_date,
            func.date(Invoice.created_at) <= to_date,
        )
    )
    if property_id:
        inv_query = inv_query.where(Stay.property_id == property_id)

    inv_result = await db.execute(inv_query)
    inv_row = inv_result.one()
    total_revenue = float(inv_row[0] or 0)
    room_revenue = float(inv_row[1] or 0)
    service_revenue = float(inv_row[2] or 0)
    total_invoices = int(inv_row[3] or 0)

    # 2. Total Stays in Period
    stay_count_q = (
        select(func.count(Stay.id))
        .join(Property, Stay.property_id == Property.id)
        .where(
            Property.organization_id == current_user.organization_id,
            func.date(Stay.actual_check_in) >= from_date,
            func.date(Stay.actual_check_in) <= to_date,
        )
    )
    if property_id:
        stay_count_q = stay_count_q.where(Stay.property_id == property_id)
    total_stays = int((await db.execute(stay_count_q)).scalar_one() or 0)

    # 3. Today's Revenue
    today_q = (
        select(func.coalesce(func.sum(Payment.amount), 0))
        .join(Invoice, Payment.invoice_id == Invoice.id)
        .join(Stay, Invoice.stay_id == Stay.id)
        .join(Property, Stay.property_id == Property.id)
        .where(
            Property.organization_id == current_user.organization_id,
            func.date(Payment.created_at) == today,
        )
    )
    if property_id:
        today_q = today_q.where(Stay.property_id == property_id)
    today_revenue = float((await db.execute(today_q)).scalar_one() or 0)

    # If today's payment is 0, also check today's finalized invoices
    if today_revenue == 0:
        today_inv_q = (
            select(func.coalesce(func.sum(Invoice.grand_total), 0))
            .join(Stay, Invoice.stay_id == Stay.id)
            .join(Property, Stay.property_id == Property.id)
            .where(
                Property.organization_id == current_user.organization_id,
                func.date(Invoice.created_at) == today,
            )
        )
        if property_id:
            today_inv_q = today_inv_q.where(Stay.property_id == property_id)
        today_revenue = float((await db.execute(today_inv_q)).scalar_one() or 0)

    # 4. This Month's Revenue
    first_of_month = today.replace(day=1)
    month_q = (
        select(func.coalesce(func.sum(Payment.amount), 0))
        .join(Invoice, Payment.invoice_id == Invoice.id)
        .join(Stay, Invoice.stay_id == Stay.id)
        .join(Property, Stay.property_id == Property.id)
        .where(
            Property.organization_id == current_user.organization_id,
            func.date(Payment.created_at) >= first_of_month,
            func.date(Payment.created_at) <= today,
        )
    )
    if property_id:
        month_q = month_q.where(Stay.property_id == property_id)
    month_revenue = float((await db.execute(month_q)).scalar_one() or 0)

    if month_revenue == 0 and total_revenue > 0:
        month_revenue = total_revenue

    # 5. Payment Methods Breakdown
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

    # 6. Room Inventory & Metrics (ADR & RevPAR)
    room_count_query = (
        select(func.count(Room.id))
        .join(Property, Room.property_id == Property.id)
        .where(Property.organization_id == current_user.organization_id, Room.is_active == True)
    )
    if property_id:
        room_count_query = room_count_query.where(Room.property_id == property_id)
    total_rooms = int((await db.execute(room_count_query)).scalar_one() or 0)

    total_days = max(1, (to_date - from_date).days + 1)
    total_room_nights = total_rooms * total_days
    occupancy_rate = (total_stays / total_room_nights * 100) if total_room_nights > 0 else 0
    adr = (room_revenue / total_stays) if total_stays > 0 else (total_revenue / total_stays if total_stays > 0 else 0)
    revpar = (room_revenue / total_room_nights) if total_room_nights > 0 else (total_revenue / total_room_nights if total_room_nights > 0 else 0)

    # 7. Recent Transactions Feed
    tx_q = (
        select(Payment, Invoice, Stay, Guest, Room)
        .join(Invoice, Payment.invoice_id == Invoice.id)
        .join(Stay, Invoice.stay_id == Stay.id)
        .join(Guest, Stay.primary_guest_id == Guest.id)
        .join(Room, Stay.room_id == Room.id)
        .join(Property, Stay.property_id == Property.id)
        .where(Property.organization_id == current_user.organization_id)
        .order_by(desc(Payment.created_at))
        .limit(10)
    )
    if property_id:
        tx_q = tx_q.where(Stay.property_id == property_id)

    tx_res = await db.execute(tx_q)
    recent_transactions = []
    for p_obj, inv_obj, stay_obj, g_obj, r_obj in tx_res.all():
        recent_transactions.append({
            "id": str(p_obj.id),
            "amount": float(p_obj.amount),
            "payment_method": p_obj.payment_method.value,
            "guest_name": g_obj.full_name,
            "room_number": r_obj.room_number,
            "reference": p_obj.reference or inv_obj.invoice_number,
            "created_at": p_obj.created_at.isoformat(),
        })

    return success(data={
        "period": {"from": from_date.isoformat(), "to": to_date.isoformat()},
        "total_revenue": total_revenue,
        "today_revenue": today_revenue,
        "month_revenue": month_revenue,
        "room_revenue": room_revenue,
        "service_revenue": service_revenue,
        "total_stays": total_stays,
        "total_invoices": total_invoices,
        "occupancy_rate": round(occupancy_rate, 2),
        "adr": round(adr, 2),
        "revpar": round(revpar, 2),
        "payments_by_method": payments_by_method,
        "recent_transactions": recent_transactions,
    })


@router.get("/occupancy", response_model=dict)
async def occupancy_report(
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    property_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.REPORT_VIEW)),
):
    """Live room status distribution and historical occupancy metrics."""
    today = date.today()
    if not to_date:
        to_date = today
    if not from_date:
        from_date = to_date - timedelta(days=30)

    # 1. Current Live Room Status Distribution
    room_q = (
        select(Room.status, func.count(Room.id))
        .join(Property, Room.property_id == Property.id)
        .where(Property.organization_id == current_user.organization_id, Room.is_active == True)
        .group_by(Room.status)
    )
    if property_id:
        room_q = room_q.where(Room.property_id == property_id)
    
    room_counts_raw = dict((await db.execute(room_q)).all())
    room_status = {
        s.value if hasattr(s, "value") else str(s): count
        for s, count in room_counts_raw.items()
    }

    total_rooms = sum(room_status.values())
    occupied_rooms = room_status.get("OCCUPIED", 0)
    available_rooms = room_status.get("AVAILABLE", 0)
    cleaning_rooms = room_status.get("CLEANING", 0)
    maintenance_rooms = room_status.get("MAINTENANCE", 0)
    reserved_rooms = room_status.get("RESERVED", 0)
    out_of_service_rooms = room_status.get("OUT_OF_SERVICE", 0)

    current_occupancy_rate = round((occupied_rooms / total_rooms * 100), 1) if total_rooms > 0 else 0

    # 2. Historical Stay Count in Period
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

    total_days = max(1, (to_date - from_date).days + 1)
    total_room_nights = total_rooms * total_days
    period_occupancy_rate = round((total_stays / total_room_nights * 100), 2) if total_room_nights > 0 else 0

    return success(data={
        "period": {"from": from_date.isoformat(), "to": to_date.isoformat()},
        "total_rooms": total_rooms,
        "occupied_rooms": occupied_rooms,
        "available_rooms": available_rooms,
        "cleaning_rooms": cleaning_rooms,
        "maintenance_rooms": maintenance_rooms,
        "reserved_rooms": reserved_rooms,
        "out_of_service_rooms": out_of_service_rooms,
        "occupancy_rate": current_occupancy_rate,
        "period_occupancy_rate": period_occupancy_rate,
        "total_stays": total_stays,
        "total_room_nights": total_room_nights,
        "room_status": room_status,
    })


@router.get("/payments", response_model=dict)
async def payment_report(
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    property_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.REPORT_VIEW)),
):
    """Detailed payments summary and method breakdown."""
    if not to_date:
        to_date = date.today()
    if not from_date:
        from_date = to_date - timedelta(days=30)

    query = (
        select(func.coalesce(func.sum(Payment.amount), 0), func.count(Payment.id))
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

    # Breakdown by method
    pm_q = (
        select(Payment.payment_method, func.sum(Payment.amount), func.count(Payment.id))
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
        pm_q = pm_q.where(Stay.property_id == property_id)

    pm_res = await db.execute(pm_q)
    breakdown = [
        {
            "method": r[0].value,
            "amount": float(r[1]),
            "count": int(r[2]),
        }
        for r in pm_res.all()
    ]

    return success(data={
        "period": {"from": from_date.isoformat(), "to": to_date.isoformat()},
        "total_payments": float(row[0] or 0),
        "payment_count": int(row[1] or 0),
        "breakdown": breakdown,
    })


@router.get("/dashboard", response_model=dict)
async def dashboard_stats(
    property_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.REPORT_VIEW)),
):
    """Real-time PMS operations dashboard statistics."""
    today = date.today()

    # Room status counts
    room_q = (
        select(Room.status, func.count(Room.id))
        .join(Property, Room.property_id == Property.id)
        .where(Property.organization_id == current_user.organization_id, Room.is_active == True)
        .group_by(Room.status)
    )
    if property_id:
        room_q = room_q.where(Room.property_id == property_id)
    room_counts_raw = dict((await db.execute(room_q)).all())
    room_status = {
        s.value if hasattr(s, "value") else str(s): count
        for s, count in room_counts_raw.items()
    }

    # Today's check-ins
    checkin_q = (
        select(func.count(Stay.id))
        .join(Property, Stay.property_id == Property.id)
        .where(
            Property.organization_id == current_user.organization_id,
            func.date(Stay.actual_check_in) == today,
        )
    )
    if property_id:
        checkin_q = checkin_q.where(Stay.property_id == property_id)
    todays_checkins = int((await db.execute(checkin_q)).scalar_one() or 0)

    # Today's checkouts
    checkout_q = (
        select(func.count(Stay.id))
        .join(Property, Stay.property_id == Property.id)
        .where(
            Property.organization_id == current_user.organization_id,
            func.date(Stay.actual_checkout) == today,
            Stay.is_completed == True,
        )
    )
    if property_id:
        checkout_q = checkout_q.where(Stay.property_id == property_id)
    todays_checkouts = int((await db.execute(checkout_q)).scalar_one() or 0)

    # Today's revenue
    revenue_q = (
        select(func.coalesce(func.sum(Payment.amount), 0))
        .join(Invoice, Payment.invoice_id == Invoice.id)
        .join(Stay, Invoice.stay_id == Stay.id)
        .join(Property, Stay.property_id == Property.id)
        .where(
            Property.organization_id == current_user.organization_id,
            func.date(Payment.created_at) == today,
        )
    )
    if property_id:
        revenue_q = revenue_q.where(Stay.property_id == property_id)
    todays_revenue = float((await db.execute(revenue_q)).scalar_one() or 0)

    if todays_revenue == 0:
        inv_rev_q = (
            select(func.coalesce(func.sum(Invoice.grand_total), 0))
            .join(Stay, Invoice.stay_id == Stay.id)
            .join(Property, Stay.property_id == Property.id)
            .where(
                Property.organization_id == current_user.organization_id,
                func.date(Invoice.created_at) == today,
            )
        )
        if property_id:
            inv_rev_q = inv_rev_q.where(Stay.property_id == property_id)
        todays_revenue = float((await db.execute(inv_rev_q)).scalar_one() or 0)

    return success(data={
        "room_status": room_status,
        "todays_check_ins": todays_checkins,
        "todays_check_outs": todays_checkouts,
        "todays_revenue": todays_revenue,
    })
