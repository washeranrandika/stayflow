"""Tests for room availability and booking overlap prevention."""
import pytest
from datetime import date, datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.models import Reservation, ReservationStatusEnum, BookingSourceEnum, StayTypeEnum


@pytest.mark.asyncio
async def test_room_availability_no_conflicts(db: AsyncSession, available_room, guest, org, owner_user):
    """Room should be available when no overlapping reservations exist."""
    from app.rooms.service import room_service

    check_in = datetime(2025, 10, 1, 14, 0, tzinfo=timezone.utc)
    checkout = datetime(2025, 10, 3, 11, 0, tzinfo=timezone.utc)

    is_available = await room_service.check_availability(db, available_room.id, check_in, checkout)
    assert is_available is True


@pytest.mark.asyncio
async def test_room_availability_with_overlap(db: AsyncSession, available_room, guest, property1, org, owner_user):
    """Room should NOT be available when overlapping reservation exists."""
    from app.rooms.service import room_service
    import uuid, random, string

    user, member = owner_user

    # Create a confirmed reservation
    res = Reservation(
        reservation_number=f"SF-TEST-{''.join(random.choices(string.digits, k=6))}",
        property_id=property1.id,
        room_id=available_room.id,
        primary_guest_id=guest.id,
        stay_type=StayTypeEnum.OVERNIGHT,
        check_in_date=date(2025, 10, 1),
        expected_checkout_date=date(2025, 10, 3),
        status=ReservationStatusEnum.CONFIRMED,
        booking_source=BookingSourceEnum.WALK_IN,
        created_by=user.id,
    )
    db.add(res)
    await db.flush()

    # Overlapping dates should fail
    check_in = datetime(2025, 10, 2, 14, 0, tzinfo=timezone.utc)
    checkout = datetime(2025, 10, 4, 11, 0, tzinfo=timezone.utc)

    is_available = await room_service.check_availability(db, available_room.id, check_in, checkout)
    assert is_available is False


@pytest.mark.asyncio
async def test_room_availability_adjacent_booking(db: AsyncSession, available_room, guest, property1, owner_user):
    """Adjacent (not overlapping) bookings should both be allowed."""
    from app.rooms.service import room_service
    import random, string

    user, member = owner_user

    # Book Oct 1-3
    res = Reservation(
        reservation_number=f"SF-TEST-{''.join(random.choices(string.digits, k=6))}",
        property_id=property1.id,
        room_id=available_room.id,
        primary_guest_id=guest.id,
        stay_type=StayTypeEnum.OVERNIGHT,
        check_in_date=date(2025, 10, 1),
        expected_checkout_date=date(2025, 10, 3),
        status=ReservationStatusEnum.CONFIRMED,
        booking_source=BookingSourceEnum.WALK_IN,
        created_by=user.id,
    )
    db.add(res)
    await db.flush()

    # Check Oct 3-5 (starts when first one ends — should be available)
    check_in = datetime(2025, 10, 3, 14, 0, tzinfo=timezone.utc)
    checkout = datetime(2025, 10, 5, 11, 0, tzinfo=timezone.utc)

    is_available = await room_service.check_availability(db, available_room.id, check_in, checkout)
    assert is_available is True
