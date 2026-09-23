"""
Rooms service — including availability check with DB-level locking.
This is critical for preventing double bookings.
"""
import uuid
from datetime import date, datetime
from typing import Optional, List
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import selectinload

from app.core.models import Room, Reservation, Stay, RoomStatusEnum, ReservationStatusEnum, RoomStatusHistory, Property
from app.core.exceptions import RoomNotAvailableError, BookingOverlapError, TenantViolationError
from app.audit.service import audit_log


class RoomService:

    async def verify_property_ownership(self, db: AsyncSession, property_id: uuid.UUID, org_id: uuid.UUID) -> Property:
        result = await db.execute(
            select(Property).where(Property.id == property_id, Property.organization_id == org_id)
        )
        prop = result.scalar_one_or_none()
        if not prop:
            raise TenantViolationError()
        return prop

    async def get_rooms_for_property(
        self,
        db: AsyncSession,
        property_id: uuid.UUID,
        org_id: uuid.UUID,
        status_filter: Optional[str] = None,
    ) -> List[Room]:
        # Verify tenant ownership
        await self.verify_property_ownership(db, property_id, org_id)

        query = (
            select(Room)
            .options(selectinload(Room.room_type))
            .where(Room.property_id == property_id, Room.is_active == True)
        )
        if status_filter:
            query = query.where(Room.status == status_filter)

        result = await db.execute(query.order_by(Room.room_number))
        return result.scalars().all()

    async def get_by_id(self, db: AsyncSession, room_id: uuid.UUID, org_id: uuid.UUID) -> Room:
        result = await db.execute(
            select(Room)
            .options(selectinload(Room.room_type))
            .join(Property, Room.property_id == Property.id)
            .where(Room.id == room_id, Property.organization_id == org_id)
        )
        room = result.scalar_one_or_none()
        if not room:
            raise HTTPException(status_code=404, detail={"code": "ROOM_NOT_FOUND", "message": "Room not found"})
        return room

    async def create(self, db: AsyncSession, org_id: uuid.UUID, user_id: uuid.UUID, data: dict) -> Room:
        await self.verify_property_ownership(db, data["property_id"], org_id)

        # Check room number uniqueness within property
        result = await db.execute(
            select(Room).where(
                Room.property_id == data["property_id"],
                Room.room_number == data["room_number"],
            )
        )
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=409,
                detail={"code": "ROOM_NUMBER_EXISTS", "message": f"Room {data['room_number']} already exists in this property"},
            )

        room = Room(**data)
        db.add(room)
        await db.flush()
        await audit_log(db, "room.create", "room", str(room.id), org_id, user_id, new_values={"room_number": data["room_number"]})
        return room

    async def update_status(
        self,
        db: AsyncSession,
        room_id: uuid.UUID,
        org_id: uuid.UUID,
        user_id: uuid.UUID,
        new_status: str,
        notes: Optional[str] = None,
    ) -> Room:
        room = await self.get_by_id(db, room_id, org_id)
        old_status = room.status

        # Validate status transition
        valid_transitions = {
            RoomStatusEnum.AVAILABLE: [RoomStatusEnum.MAINTENANCE, RoomStatusEnum.OUT_OF_SERVICE, RoomStatusEnum.RESERVED],
            RoomStatusEnum.RESERVED: [RoomStatusEnum.OCCUPIED, RoomStatusEnum.AVAILABLE, RoomStatusEnum.MAINTENANCE],
            RoomStatusEnum.OCCUPIED: [RoomStatusEnum.CLEANING],
            RoomStatusEnum.CLEANING: [RoomStatusEnum.AVAILABLE, RoomStatusEnum.MAINTENANCE],
            RoomStatusEnum.MAINTENANCE: [RoomStatusEnum.AVAILABLE, RoomStatusEnum.OUT_OF_SERVICE],
            RoomStatusEnum.OUT_OF_SERVICE: [RoomStatusEnum.MAINTENANCE, RoomStatusEnum.AVAILABLE],
        }

        new_status_enum = RoomStatusEnum(new_status)
        if new_status_enum not in valid_transitions.get(room.status, []):
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "INVALID_STATUS_TRANSITION",
                    "message": f"Cannot transition room from {room.status} to {new_status}",
                },
            )

        room.status = new_status_enum

        # Record history
        history = RoomStatusHistory(
            room_id=room.id,
            from_status=old_status,
            to_status=new_status_enum,
            changed_by=user_id,
            notes=notes,
        )
        db.add(history)
        await audit_log(
            db, "room.status_change", "room", str(room_id), org_id, user_id,
            old_values={"status": old_status.value},
            new_values={"status": new_status},
        )
        return room

    async def check_availability(
        self,
        db: AsyncSession,
        room_id: uuid.UUID,
        check_in: datetime,
        checkout: datetime,
        exclude_reservation_id: Optional[uuid.UUID] = None,
    ) -> bool:
        """
        Check if a room is available for the given datetime range.
        Uses DB-level query to detect overlapping reservations and stays.
        CRITICAL: Called within a transaction with appropriate locking for booking.
        """
        # Check active reservations with overlapping dates
        overlap_filter = and_(
            Reservation.room_id == room_id,
            Reservation.status.in_([
                ReservationStatusEnum.PENDING,
                ReservationStatusEnum.CONFIRMED,
                ReservationStatusEnum.CHECKED_IN,
            ]),
            # Overlap condition: not (checkout <= existing_checkin OR checkin >= existing_checkout)
            not_(or_(
                func.date(Reservation.expected_checkout_date) <= check_in.date(),
                func.date(Reservation.check_in_date) >= checkout.date(),
            )),
        )
        if exclude_reservation_id:
            overlap_filter = and_(overlap_filter, Reservation.id != exclude_reservation_id)

        result = await db.execute(select(func.count()).where(overlap_filter))
        reservation_count = result.scalar_one()

        # Check active stays
        stay_overlap = and_(
            Stay.room_id == room_id,
            Stay.is_completed == False,
            or_(
                and_(Stay.actual_check_in <= check_in, Stay.expected_checkout > check_in),
                and_(Stay.actual_check_in < checkout, Stay.expected_checkout >= checkout),
                and_(Stay.actual_check_in >= check_in, Stay.expected_checkout <= checkout),
            ),
        )
        result = await db.execute(select(func.count()).where(stay_overlap))
        stay_count = result.scalar_one()

        return reservation_count == 0 and stay_count == 0

    async def lock_room_for_booking(self, db: AsyncSession, room_id: uuid.UUID) -> Room:
        """
        SELECT ... FOR UPDATE to prevent concurrent double bookings.
        Must be called within a transaction.
        """
        from sqlalchemy import text
        result = await db.execute(
            select(Room)
            .where(Room.id == room_id)
            .with_for_update()
        )
        room = result.scalar_one_or_none()
        if not room:
            raise HTTPException(status_code=404, detail={"code": "ROOM_NOT_FOUND", "message": "Room not found"})
        return room


def not_(clause):
    from sqlalchemy import not_
    return not_(clause)


room_service = RoomService()
