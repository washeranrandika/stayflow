"""
Stays service — check-in, checkout, and stay management.
This is the core operational workflow.
"""
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload

from app.core.models import (
    Stay, Room, Reservation, Folio, Invoice, Payment, HousekeepingTask, RoomStatusHistory,
    RoomStatusEnum, ReservationStatusEnum, HousekeepingStatusEnum, HousekeepingPriorityEnum,
    Property, Guest,
)
from app.core.exceptions import TenantViolationError
from app.pricing.engine import PricingInput, calculate_pricing
from app.audit.service import audit_log
from app.notifications.service import notification_service


class StayService:

    async def _verify_room_org(self, db, room_id, org_id) -> Room:
        result = await db.execute(
            select(Room)
            .options(selectinload(Room.room_type))
            .join(Property, Room.property_id == Property.id)
            .where(Room.id == room_id, Property.organization_id == org_id)
        )
        room = result.scalar_one_or_none()
        if not room:
            raise TenantViolationError()
        return room

    async def check_in(
        self,
        db: AsyncSession,
        org_id: uuid.UUID,
        user_id: uuid.UUID,
        data: dict,
    ) -> Stay:
        """
        Check-in creates a Stay record and sets room to OCCUPIED.
        If from a reservation, links the stay and updates reservation status.
        """
        room_id = data["room_id"]

        # Lock room row (prevent concurrent check-ins to same room)
        result = await db.execute(
            select(Room)
            .options(selectinload(Room.room_type))
            .where(Room.id == room_id)
            .with_for_update()
        )
        room = result.scalar_one_or_none()
        if not room:
            raise HTTPException(status_code=404, detail={"code": "ROOM_NOT_FOUND", "message": "Room not found"})

        # Verify tenant ownership
        result = await db.execute(
            select(Property).where(Property.id == room.property_id, Property.organization_id == org_id)
        )
        if not result.scalar_one_or_none():
            raise TenantViolationError()

        # Room must be AVAILABLE or RESERVED
        if room.status not in [RoomStatusEnum.AVAILABLE, RoomStatusEnum.RESERVED]:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "ROOM_NOT_AVAILABLE",
                    "message": f"Room {room.room_number} is {room.status.value} and cannot be checked into",
                },
            )

        # Verify guest
        result = await db.execute(
            select(Guest).where(Guest.id == data["primary_guest_id"], Guest.organization_id == org_id)
        )
        guest = result.scalar_one_or_none()
        if not guest:
            raise TenantViolationError()

        now = datetime.now(timezone.utc)

        # Create stay
        stay = Stay(
            reservation_id=data.get("reservation_id"),
            property_id=room.property_id,
            room_id=room_id,
            primary_guest_id=data["primary_guest_id"],
            stay_type=data["stay_type"],
            actual_check_in=now,
            expected_checkout=data["expected_checkout"],
            num_guests=data.get("num_guests", 1),
            checked_in_by=user_id,
            notes=data.get("notes"),
        )
        db.add(stay)
        await db.flush()

        # Create folio
        folio = Folio(stay_id=stay.id)
        db.add(folio)

        # Update room status
        old_status = room.status
        room.status = RoomStatusEnum.OCCUPIED
        history = RoomStatusHistory(
            room_id=room.id,
            from_status=old_status,
            to_status=RoomStatusEnum.OCCUPIED,
            changed_by=user_id,
            notes=f"Check-in for stay {stay.id}",
        )
        db.add(history)

        # Update reservation if linked
        if data.get("reservation_id"):
            await db.execute(
                update(Reservation)
                .where(Reservation.id == data["reservation_id"])
                .values(status=ReservationStatusEnum.CHECKED_IN)
            )

        await audit_log(
            db, "stay.check_in", "stay", str(stay.id), org_id, user_id,
            new_values={
                "room_id": str(room_id),
                "guest_id": str(data["primary_guest_id"]),
                "stay_type": data["stay_type"],
                "expected_checkout": data["expected_checkout"].isoformat(),
            }
        )

        # Queue checkout reminders (background job)
        await notification_service.schedule_checkout_reminders(stay.id, stay.expected_checkout, org_id)

        await db.flush()
        return stay

    async def get_by_id(self, db: AsyncSession, stay_id: uuid.UUID, org_id: uuid.UUID) -> Stay:
        result = await db.execute(
            select(Stay)
            .join(Property, Stay.property_id == Property.id)
            .options(
                selectinload(Stay.room).selectinload(Room.room_type),
                selectinload(Stay.primary_guest),
                selectinload(Stay.folio).selectinload(Folio.items),
                selectinload(Stay.folio).selectinload(Folio.invoice).selectinload(Invoice.payments).selectinload(Payment.refunds),
                selectinload(Stay.service_orders),
            )
            .where(Stay.id == stay_id, Property.organization_id == org_id)
        )
        stay = result.scalar_one_or_none()
        if not stay:
            raise HTTPException(status_code=404, detail={"code": "STAY_NOT_FOUND", "message": "Stay not found"})
        return stay

    async def get_pricing_estimate(self, db: AsyncSession, stay: Stay) -> dict:
        """Calculate current pricing for a stay (for display during checkout)."""
        result = await db.execute(
            select(Room).options(selectinload(Room.room_type)).where(Room.id == stay.room_id)
        )
        room = result.scalar_one_or_none()
        if not room or not room.room_type:
            raise HTTPException(status_code=404, detail={"code": "ROOM_TYPE_NOT_FOUND", "message": "Room type not found for this stay"})
        rt = room.room_type

        # Sum services from folio
        services_total = Decimal("0")
        if stay.folio and stay.folio.items:
            services_total = sum(item.total for item in stay.folio.items if item.category != "ROOM")

        now = datetime.now(timezone.utc)

        stay_type_str = stay.stay_type.value if hasattr(stay.stay_type, "value") else str(stay.stay_type)
        pricing_input = PricingInput(
            stay_type=stay_type_str,
            actual_check_in=stay.actual_check_in,
            expected_checkout=stay.expected_checkout,
            actual_checkout=now,
            num_guests=stay.num_guests,
            max_guests_included=rt.max_guests,
            base_hourly_rate=rt.base_hourly_rate,
            base_day_use_rate=rt.base_day_use_rate,
            base_nightly_rate=rt.base_nightly_rate,
            base_daily_rate=rt.base_daily_rate,
            extra_hour_rate=rt.extra_hour_rate,
            extra_guest_rate=rt.extra_guest_rate,
            services_total=services_total,
        )
        result = calculate_pricing(pricing_input)
        return {
            "room_charge": float(result.room_charge),
            "extra_hour_charge": float(result.extra_hour_charge),
            "extra_guest_charge": float(result.extra_guest_charge),
            "services_total": float(result.services_total),
            "service_charge": float(result.service_charge),
            "discount": float(result.discount),
            "tax": float(result.tax),
            "subtotal": float(result.subtotal),
            "grand_total": float(result.grand_total),
            "breakdown": [{"label": b.label, "amount": float(b.amount), "is_deduction": b.is_deduction} for b in result.breakdown],
        }

    async def checkout(
        self,
        db: AsyncSession,
        stay_id: uuid.UUID,
        org_id: uuid.UUID,
        user_id: uuid.UUID,
        discount: Decimal = Decimal("0"),
        notes: Optional[str] = None,
        damage_items: Optional[list] = None,
    ) -> dict:
        """
        Process checkout:
        1. Add any damage or extra items to folio
        2. Calculate final pricing
        3. Create/finalize invoice
        4. Set room to CLEANING
        5. Create housekeeping task
        6. Mark stay as completed
        """
        stay = await self.get_by_id(db, stay_id, org_id)

        if stay.is_completed:
            raise HTTPException(status_code=400, detail={"code": "STAY_COMPLETED", "message": "This stay is already checked out"})

        now = datetime.now(timezone.utc)
        folio = stay.folio

        # Add damage / extra charge items to folio if provided
        if damage_items and folio:
            from app.core.models import FolioItem
            for item in damage_items:
                amount = Decimal(str(item.get("amount", 0)))
                if amount > 0:
                    desc = item.get("description") or "Damage Fee"
                    fi = FolioItem(
                        folio_id=folio.id,
                        category="DAMAGE",
                        description=desc,
                        quantity=Decimal("1"),
                        unit_price=amount,
                        total=amount,
                        created_by=user_id,
                        notes=item.get("notes"),
                    )
                    db.add(fi)
            await db.flush()
            # Refresh folio items in memory
            await db.refresh(folio, ["items"])

        # Load room type for pricing
        result = await db.execute(
            select(Room).options(selectinload(Room.room_type)).where(Room.id == stay.room_id)
        )
        room = result.scalar_one()
        rt = room.room_type

        # Calculate services total (including newly added damage charges)
        services_total = Decimal("0")
        if folio and folio.items:
            services_total = sum(item.total for item in folio.items if item.category != "ROOM")

        stay_type_str = stay.stay_type.value if hasattr(stay.stay_type, "value") else str(stay.stay_type)
        pricing_input = PricingInput(
            stay_type=stay_type_str,
            actual_check_in=stay.actual_check_in,
            expected_checkout=stay.expected_checkout,
            actual_checkout=now,
            num_guests=stay.num_guests,
            max_guests_included=rt.max_guests,
            base_hourly_rate=rt.base_hourly_rate,
            base_day_use_rate=rt.base_day_use_rate,
            base_nightly_rate=rt.base_nightly_rate,
            base_daily_rate=rt.base_daily_rate,
            extra_hour_rate=rt.extra_hour_rate,
            extra_guest_rate=rt.extra_guest_rate,
            discount=discount,
            services_total=services_total,
        )
        pricing = calculate_pricing(pricing_input)

        # Calculate paid amount from existing payments
        paid_amount = Decimal("0")
        if folio and folio.invoice:
            invoice = folio.invoice
            for payment in invoice.payments:
                paid_amount += payment.amount
                # Subtract refunds
                for refund in payment.refunds:
                    paid_amount -= refund.amount

        pricing.with_payment(paid_amount)

        # Create or update invoice
        import random, string
        inv_num = f"INV-{now.strftime('%Y%m%d')}-{''.join(random.choices(string.digits, k=6))}"

        if folio and folio.invoice:
            invoice = folio.invoice
            if invoice.is_finalized:
                raise HTTPException(status_code=400, detail={"code": "INVOICE_FINALIZED", "message": "Invoice already finalized"})
        else:
            invoice = Invoice(
                invoice_number=inv_num,
                folio_id=folio.id if folio else None,
                stay_id=stay_id,
                guest_id=stay.primary_guest_id,
            )
            db.add(invoice)

        invoice.room_charge = pricing.room_charge
        invoice.services_total = pricing.services_total
        invoice.discount = pricing.discount
        invoice.tax = pricing.tax
        invoice.grand_total = pricing.grand_total
        invoice.is_finalized = True
        invoice.finalized_at = now
        if notes:
            invoice.notes = notes

        if folio:
            folio.is_finalized = True
            folio.finalized_at = now

        # Mark stay complete & save notes
        stay.is_completed = True
        stay.actual_checkout = now
        stay.checked_out_by = user_id
        if notes:
            stay.notes = (stay.notes + " | Checkout: " + notes) if stay.notes else f"Checkout: {notes}"

        # Set room to CLEANING
        old_room_status = room.status
        room.status = RoomStatusEnum.CLEANING
        db.add(RoomStatusHistory(
            room_id=room.id,
            from_status=old_room_status,
            to_status=RoomStatusEnum.CLEANING,
            changed_by=user_id,
            notes=f"Auto: checkout of stay {stay_id}",
        ))

        # Update reservation status
        if stay.reservation_id:
            await db.execute(
                update(Reservation)
                .where(Reservation.id == stay.reservation_id)
                .values(status=ReservationStatusEnum.COMPLETED)
            )

        # Create housekeeping task
        hk_task = HousekeepingTask(
            property_id=stay.property_id,
            room_id=stay.room_id,
            stay_id=stay_id,
            status=HousekeepingStatusEnum.PENDING,
            priority=HousekeepingPriorityEnum.NORMAL,
            notes=f"Post-checkout cleaning for room {room.room_number}",
        )
        db.add(hk_task)

        await audit_log(
            db, "stay.checkout", "stay", str(stay_id), org_id, user_id,
            new_values={
                "grand_total": float(pricing.grand_total),
                "actual_checkout": now.isoformat(),
                "notes": notes,
                "damage_items_count": len(damage_items) if damage_items else 0,
            }
        )
        await db.flush()

        return {
            "stay_id": str(stay_id),
            "invoice_id": str(invoice.id) if invoice.id else None,
            "pricing": {
                "room_charge": float(pricing.room_charge),
                "extra_hour_charge": float(pricing.extra_hour_charge),
                "extra_guest_charge": float(pricing.extra_guest_charge),
                "services_total": float(pricing.services_total),
                "discount": float(pricing.discount),
                "tax": float(pricing.tax),
                "grand_total": float(pricing.grand_total),
                "paid_amount": float(pricing.paid_amount),
                "balance": float(pricing.balance),
                "breakdown": [{"label": b.label, "amount": float(b.amount), "is_deduction": b.is_deduction} for b in pricing.breakdown],
            },
            "housekeeping_task_created": True,
            "room_status": room.status.value,
        }

    async def extend_stay(
        self,
        db: AsyncSession,
        stay_id: uuid.UUID,
        org_id: uuid.UUID,
        user_id: uuid.UUID,
        new_expected_checkout: datetime,
        notes: Optional[str] = None,
    ) -> Stay:
        """Extend stay duration with new expected checkout date/time."""
        stay = await self.get_by_id(db, stay_id, org_id)
        if stay.is_completed:
            raise HTTPException(status_code=400, detail={"code": "STAY_COMPLETED", "message": "Cannot extend a completed stay"})

        old_checkout = stay.expected_checkout
        stay.expected_checkout = new_expected_checkout
        if notes:
            stay.notes = (stay.notes + " | Extension: " + notes) if stay.notes else f"Extension: {notes}"

        await audit_log(
            db, "stay.extend", "stay", str(stay.id), org_id, user_id,
            new_values={
                "old_expected_checkout": old_checkout.isoformat() if old_checkout else None,
                "new_expected_checkout": new_expected_checkout.isoformat(),
                "notes": notes,
            }
        )
        await db.flush()
        return stay


# Import Invoice here to avoid circular imports
from app.core.models import Invoice

stay_service = StayService()
