"""
Tests for stay lifecycle: check-in, checkout, housekeeping task generation, room status transition,
and folio/invoice snapshots.
"""
import pytest
import uuid
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.models import (
    Stay, Folio, FolioItem, Invoice, Payment, HousekeepingTask,
    Room, RoomStatusEnum, StayTypeEnum, HousekeepingStatusEnum,
    PaymentMethodEnum, AuditLog
)
from app.stays.service import stay_service
from app.billing.service import billing_service
from app.payments.service import payment_service
from app.housekeeping.service import housekeeping_service


@pytest.mark.asyncio
async def test_checkin_and_checkout_lifecycle(
    db: AsyncSession, org, property1, room_type, available_room, guest, owner_user
):
    user, member = owner_user

    # 1. Room is initially AVAILABLE
    assert available_room.status == RoomStatusEnum.AVAILABLE

    # 2. Check-in
    now = datetime.now(timezone.utc)
    expected_checkout = now + timedelta(hours=3)

    stay = await stay_service.check_in(
        db=db,
        data={
            "room_id": available_room.id,
            "primary_guest_id": guest.id,
            "stay_type": "HOURLY",
            "expected_checkout": expected_checkout,
            "num_guests": 1,
        },
        user_id=user.id,
        org_id=org.id,
    )

    assert stay.id is not None
    assert stay.actual_check_in is not None

    # Room must now be OCCUPIED
    await db.refresh(available_room)
    assert available_room.status == RoomStatusEnum.OCCUPIED

    # Folio should exist
    result = await db.execute(select(Folio).where(Folio.stay_id == stay.id))
    folio = result.scalar_one_or_none()
    assert folio is not None

    # 3. Add extra service charge to folio
    item = await billing_service.add_item(
        db=db,
        folio_id=folio.id,
        category="FOOD",
        description="Fresh Juice & Sandwich",
        quantity=Decimal("2"),
        unit_price=Decimal("450"),
        created_by=user.id,
    )
    assert item.total == Decimal("900")

    # 4. Checkout
    checkout_result = await stay_service.checkout(
        db=db,
        stay_id=stay.id,
        org_id=org.id,
        user_id=user.id,
        discount=Decimal("0"),
    )

    assert checkout_result is not None
    assert checkout_result["room_status"] == "CLEANING"
    invoice_id = uuid.UUID(checkout_result["invoice_id"])

    inv_res = await db.execute(select(Invoice).where(Invoice.id == invoice_id))
    invoice = inv_res.scalar_one()
    assert invoice.grand_total > Decimal("0")

    # 5. Room must transition to CLEANING on checkout
    await db.refresh(available_room)
    assert available_room.status == RoomStatusEnum.CLEANING

    # 6. Housekeeping task must be automatically created
    result = await db.execute(
        select(HousekeepingTask).where(
            HousekeepingTask.room_id == available_room.id,
            HousekeepingTask.status == HousekeepingStatusEnum.PENDING,
        )
    )
    hk_task = result.scalar_one_or_none()
    assert hk_task is not None

    # 7. Housekeeping completes task -> Room transitions to AVAILABLE
    updated_task = await housekeeping_service.update_task_status(
        db=db,
        task_id=hk_task.id,
        org_id=org.id,
        user_id=user.id,
        status=HousekeepingStatusEnum.COMPLETED,
    )
    assert updated_task.status == HousekeepingStatusEnum.COMPLETED

    await db.refresh(available_room)
    assert available_room.status == RoomStatusEnum.AVAILABLE


@pytest.mark.asyncio
async def test_multiple_payments_and_refund(
    db: AsyncSession, org, property1, available_room, guest, owner_user
):
    user, member = owner_user

    # Create stay & folio
    now = datetime.now(timezone.utc)
    stay = await stay_service.check_in(
        db=db,
        data={
            "room_id": available_room.id,
            "primary_guest_id": guest.id,
            "stay_type": "HOURLY",
            "expected_checkout": now + timedelta(hours=2),
            "num_guests": 1,
        },
        user_id=user.id,
        org_id=org.id,
    )

    # Perform checkout to generate invoice
    checkout_res = await stay_service.checkout(
        db=db, stay_id=stay.id, org_id=org.id, user_id=user.id
    )
    invoice_id = uuid.UUID(checkout_res["invoice_id"])

    inv_res = await db.execute(
        select(Invoice)
        .options(selectinload(Invoice.payments).selectinload(Payment.refunds))
        .where(Invoice.id == invoice_id)
    )
    invoice = inv_res.scalar_one()

    # Initial invoice grand total
    grand_total = invoice.grand_total
    assert grand_total > Decimal("0")

    # Partial payment 1: Cash 1000
    p1 = await payment_service.record_payment(
        db=db,
        invoice_id=invoice.id,
        org_id=org.id,
        user_id=user.id,
        amount=Decimal("1000"),
        method=PaymentMethodEnum.CASH,
    )
    assert p1.amount == Decimal("1000")

    # Partial payment 2: Card remaining balance
    rem = grand_total - Decimal("1000")
    p2 = await payment_service.record_payment(
        db=db,
        invoice_id=invoice.id,
        org_id=org.id,
        user_id=user.id,
        amount=rem,
        method=PaymentMethodEnum.CARD,
    )
    assert p2.amount == rem

    # Refund test
    refund = await payment_service.refund_payment(
        db=db,
        payment_id=p1.id,
        org_id=org.id,
        user_id=user.id,
        amount=Decimal("500"),
        reason="Guest deposit adjustment",
    )
    assert refund.amount == Decimal("500")
