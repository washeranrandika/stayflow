"""
Reservations service — booking creation with overlap prevention.
Uses SELECT FOR UPDATE to prevent concurrent double-bookings.
"""
import uuid
import random
import string
from datetime import date, datetime, timezone
from typing import Optional, List

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, not_
from sqlalchemy.orm import selectinload

from app.core.models import (
    Reservation, Room, Property, Guest,
    ReservationStatusEnum, RoomStatusEnum, BookingSourceEnum, StayTypeEnum,
)
from app.core.exceptions import BookingOverlapError, TenantViolationError
from app.audit.service import audit_log


def _generate_reservation_number() -> str:
    """Generate a human-readable reservation number like SF-20250921-A3X7."""
    suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"SF-{datetime.now().strftime('%Y%m%d')}-{suffix}"


def _normalize_time(t: Optional[str]) -> Optional[str]:
    """Ensure time strings fit within 5-character VARCHAR(5) like '14:00'."""
    if not t:
        return None
    t = t.strip()
    if len(t) <= 5 and "AM" not in t.upper() and "PM" not in t.upper():
        return t
    for fmt_str in ("%I:%M %p", "%I:%M%p", "%H:%M:%S", "%H:%M"):
        try:
            return datetime.strptime(t, fmt_str).strftime("%H:%M")
        except ValueError:
            continue
    return t[:5]


class ReservationService:

    async def _verify_room_org(self, db: AsyncSession, room_id: uuid.UUID, org_id: uuid.UUID) -> Room:
        result = await db.execute(
            select(Room)
            .join(Property, Room.property_id == Property.id)
            .where(Room.id == room_id, Property.organization_id == org_id)
        )
        room = result.scalar_one_or_none()
        if not room:
            raise TenantViolationError()
        return room

    async def _check_no_overlap(
        self,
        db: AsyncSession,
        room_id: uuid.UUID,
        check_in_date: date,
        checkout_date: date,
        exclude_id: Optional[uuid.UUID] = None,
    ) -> None:
        """
        Verify no overlapping confirmed/pending reservations exist.
        Runs within a transaction after acquiring row lock on room.
        """
        q = select(func.count()).select_from(Reservation).where(
            Reservation.room_id == room_id,
            Reservation.status.in_([
                ReservationStatusEnum.PENDING,
                ReservationStatusEnum.CONFIRMED,
                ReservationStatusEnum.CHECKED_IN,
            ]),
            not_(or_(
                Reservation.expected_checkout_date <= check_in_date,
                Reservation.check_in_date >= checkout_date,
            )),
        )
        if exclude_id:
            q = q.where(Reservation.id != exclude_id)

        result = await db.execute(q)
        count = result.scalar_one()
        if count > 0:
            raise BookingOverlapError()

    async def list_reservations(
        self,
        db: AsyncSession,
        org_id: uuid.UUID,
        property_id: Optional[uuid.UUID] = None,
        status: Optional[str] = None,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
        guest_id: Optional[uuid.UUID] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[List[Reservation], int]:
        query = (
            select(Reservation)
            .join(Property, Reservation.property_id == Property.id)
            .options(
                selectinload(Reservation.room),
                selectinload(Reservation.primary_guest),
            )
            .where(Property.organization_id == org_id)
        )

        if property_id:
            query = query.where(Reservation.property_id == property_id)
        if status:
            query = query.where(Reservation.status == status)
        if from_date:
            query = query.where(Reservation.check_in_date >= from_date)
        if to_date:
            query = query.where(Reservation.check_in_date <= to_date)
        if guest_id:
            query = query.where(Reservation.primary_guest_id == guest_id)

        total_result = await db.execute(select(func.count()).select_from(query.subquery()))
        total = total_result.scalar_one()

        query = query.order_by(Reservation.check_in_date.desc()).offset((page - 1) * page_size).limit(page_size)
        result = await db.execute(query)
        return result.scalars().all(), total

    async def create(
        self,
        db: AsyncSession,
        org_id: uuid.UUID,
        user_id: uuid.UUID,
        data: dict,
    ) -> Reservation:
        # Verify room belongs to org
        room = await self._verify_room_org(db, data["room_id"], org_id)

        # Acquire row-level lock on room to prevent concurrent bookings
        await db.execute(
            select(Room).where(Room.id == data["room_id"]).with_for_update()
        )

        # Check availability
        await self._check_no_overlap(
            db,
            data["room_id"],
            data["check_in_date"],
            data["expected_checkout_date"],
        )

        # Verify room is not occupied today if check_in_date is today
        if data["check_in_date"] == date.today() and room.status == RoomStatusEnum.OCCUPIED:
            raise HTTPException(
                status_code=400,
                detail={"code": "ROOM_OCCUPIED", "message": f"Room {room.room_number} is currently occupied today. Please checkout the current guest first or choose another room."},
            )

        # Verify guest belongs to org
        result = await db.execute(
            select(Guest).where(Guest.id == data["primary_guest_id"], Guest.organization_id == org_id)
        )
        if not result.scalar_one_or_none():
            raise TenantViolationError()

        # Sanitize time formats to fit VARCHAR(5)
        if "check_in_time" in data:
            data["check_in_time"] = _normalize_time(data["check_in_time"])
        if "expected_checkout_time" in data:
            data["expected_checkout_time"] = _normalize_time(data["expected_checkout_time"])

        # Create reservation
        reservation = Reservation(
            reservation_number=_generate_reservation_number(),
            created_by=user_id,
            **data,
        )
        db.add(reservation)
        await db.flush()

        await audit_log(
            db, "reservation.create", "reservation", str(reservation.id), org_id, user_id,
            new_values={"reservation_number": reservation.reservation_number, "room_id": str(data["room_id"])}
        )
        return reservation

    async def get_by_id(self, db: AsyncSession, reservation_id: uuid.UUID, org_id: uuid.UUID) -> Reservation:
        result = await db.execute(
            select(Reservation)
            .join(Property, Reservation.property_id == Property.id)
            .options(selectinload(Reservation.room), selectinload(Reservation.primary_guest))
            .where(Reservation.id == reservation_id, Property.organization_id == org_id)
        )
        res = result.scalar_one_or_none()
        if not res:
            raise HTTPException(status_code=404, detail={"code": "RESERVATION_NOT_FOUND", "message": "Reservation not found"})
        return res

    async def cancel(
        self,
        db: AsyncSession,
        reservation_id: uuid.UUID,
        org_id: uuid.UUID,
        user_id: uuid.UUID,
        reason: str,
    ) -> Reservation:
        res = await self.get_by_id(db, reservation_id, org_id)

        if res.status in [ReservationStatusEnum.COMPLETED, ReservationStatusEnum.CANCELLED]:
            raise HTTPException(
                status_code=400,
                detail={"code": "CANNOT_CANCEL", "message": f"Cannot cancel a reservation with status {res.status}"},
            )

        old_status = res.status
        res.status = ReservationStatusEnum.CANCELLED
        res.cancellation_reason = reason
        res.cancelled_at = datetime.now(timezone.utc)

        await audit_log(
            db, "reservation.cancel", "reservation", str(reservation_id), org_id, user_id,
            old_values={"status": old_status.value}, new_values={"status": "CANCELLED", "reason": reason}
        )
        return res

    async def confirm(
        self,
        db: AsyncSession,
        reservation_id: uuid.UUID,
        org_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> Reservation:
        res = await self.get_by_id(db, reservation_id, org_id)
        if res.status != ReservationStatusEnum.PENDING:
            raise HTTPException(
                status_code=400,
                detail={"code": "CANNOT_CONFIRM", "message": f"Reservation is already {res.status.value}"},
            )
        old_status = res.status
        res.status = ReservationStatusEnum.CONFIRMED
        await audit_log(
            db, "reservation.confirm", "reservation", str(reservation_id), org_id, user_id,
            old_values={"status": old_status.value}, new_values={"status": "CONFIRMED"}
        )
        return res


reservation_service = ReservationService()
