#!/usr/bin/env python3
"""
StayFlow Demo Seed Script
Creates realistic demo data for local development.

Demo credentials (LOCAL DEVELOPMENT ONLY):
  Owner:        owner@stayflow.demo    / Demo@12345!
  Manager:      manager@stayflow.demo  / Demo@12345!
  Receptionist: reception@stayflow.demo / Demo@12345!
  Housekeeper:  housekeeper@stayflow.demo / Demo@12345!
"""
import asyncio
import uuid
import random
from datetime import datetime, date, timedelta, timezone

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import text

from app.core.config import settings
from app.core.models import (
    Organization, User, OrganizationMember, Property, RoomType, Room, Amenity, RoomAmenity,
    Guest, Reservation, Stay, Folio, FolioItem, Invoice, InvoiceItem, Payment, Service,
    ServiceOrder, HousekeepingTask, SubscriptionPlan, Subscription,
    UserRoleEnum, RoomStatusEnum, StayTypeEnum, ReservationStatusEnum, BookingSourceEnum,
    PaymentMethodEnum, ServiceCategoryEnum, HousekeepingStatusEnum, HousekeepingPriorityEnum,
)
from app.core.security import hash_password
from app.core.database import Base

DEMO_PASSWORD = "Demo@12345!"


async def seed(db: AsyncSession):
    print("🌱 Seeding StayFlow demo data...")

    # -------------------------------------------------------------------------
    # Subscription Plans
    # -------------------------------------------------------------------------
    starter = SubscriptionPlan(
        name="Starter",
        description="For small guest houses",
        price_monthly=29.00,
        price_yearly=290.00,
        max_properties=1,
        max_rooms=15,
        max_users=3,
        features={"reports": True, "housekeeping": True, "notifications": False},
    )
    professional = SubscriptionPlan(
        name="Professional",
        description="For growing hotels",
        price_monthly=79.00,
        price_yearly=790.00,
        max_properties=3,
        max_rooms=50,
        max_users=10,
        features={"reports": True, "housekeeping": True, "notifications": True, "multi_property": True},
    )
    db.add_all([starter, professional])
    await db.flush()
    print("  ✓ Subscription plans")

    # -------------------------------------------------------------------------
    # Organization
    # -------------------------------------------------------------------------
    org = Organization(
        name="StayFlow Demo Hospitality",
        slug="stayflow-demo",
        email="admin@stayflowdemo.com",
        phone="+94 11 234 5678",
        timezone="Asia/Colombo",
        currency="LKR",
    )
    db.add(org)
    await db.flush()

    subscription = Subscription(
        organization_id=org.id,
        plan_id=professional.id,
        status="active",
        current_period_start=date.today(),
        current_period_end=date.today() + timedelta(days=30),
    )
    db.add(subscription)
    print(f"  ✓ Organization: {org.name}")

    # -------------------------------------------------------------------------
    # Users
    # -------------------------------------------------------------------------
    owner = User(email="owner@stayflow.demo", full_name="Alex Rivera", hashed_password=hash_password(DEMO_PASSWORD), phone="+94 77 100 0001")
    manager = User(email="manager@stayflow.demo", full_name="Sarah Chen", hashed_password=hash_password(DEMO_PASSWORD), phone="+94 77 100 0002")
    receptionist = User(email="reception@stayflow.demo", full_name="Nimal Perera", hashed_password=hash_password(DEMO_PASSWORD), phone="+94 77 100 0003")
    housekeeper = User(email="housekeeper@stayflow.demo", full_name="Priya Silva", hashed_password=hash_password(DEMO_PASSWORD), phone="+94 77 100 0004")

    db.add_all([owner, manager, receptionist, housekeeper])
    await db.flush()

    db.add_all([
        OrganizationMember(organization_id=org.id, user_id=owner.id, role=UserRoleEnum.OWNER),
        OrganizationMember(organization_id=org.id, user_id=manager.id, role=UserRoleEnum.MANAGER),
        OrganizationMember(organization_id=org.id, user_id=receptionist.id, role=UserRoleEnum.RECEPTIONIST),
        OrganizationMember(organization_id=org.id, user_id=housekeeper.id, role=UserRoleEnum.HOUSEKEEPER),
    ])
    print("  ✓ Users (owner, manager, receptionist, housekeeper)")

    # -------------------------------------------------------------------------
    # Property
    # -------------------------------------------------------------------------
    property1 = Property(
        organization_id=org.id,
        name="Colombo Guest House",
        address="45 Galle Road",
        city="Colombo",
        country="Sri Lanka",
        phone="+94 11 234 5678",
        email="colombo@stayflowdemo.com",
        timezone="Asia/Colombo",
        check_in_time="14:00",
        check_out_time="11:00",
    )
    db.add(property1)
    await db.flush()
    print(f"  ✓ Property: {property1.name}")

    # -------------------------------------------------------------------------
    # Amenities
    # -------------------------------------------------------------------------
    amenities_data = [
        ("WiFi", "wifi"), ("Air Conditioning", "air-vent"), ("Hot Water", "droplets"),
        ("TV", "tv"), ("Minibar", "beer"), ("Safe", "lock"), ("Balcony", "sun"),
        ("Bathtub", "bath"), ("King Bed", "bed"), ("Twin Beds", "bed-double"),
    ]
    amenities = {}
    for name, icon in amenities_data:
        a = Amenity(name=name, icon=icon)
        db.add(a)
        amenities[name] = a
    await db.flush()

    # -------------------------------------------------------------------------
    # Room Types
    # -------------------------------------------------------------------------
    rt_std_nonac = RoomType(
        property_id=property1.id,
        name="Standard Non-AC",
        description="Comfortable room with natural ventilation",
        is_ac=False,
        max_guests=2,
        base_hourly_rate=800,
        base_day_use_rate=2500,
        base_nightly_rate=4000,
        base_daily_rate=4000,
        extra_hour_rate=400,
        extra_guest_rate=500,
    )
    rt_std_ac = RoomType(
        property_id=property1.id,
        name="Standard AC",
        description="Air-conditioned room with modern amenities",
        is_ac=True,
        max_guests=2,
        base_hourly_rate=1000,
        base_day_use_rate=3000,
        base_nightly_rate=5000,
        base_daily_rate=5000,
        extra_hour_rate=500,
        extra_guest_rate=500,
    )
    rt_deluxe = RoomType(
        property_id=property1.id,
        name="Deluxe",
        description="Spacious deluxe room with premium furnishings and city view",
        is_ac=True,
        max_guests=2,
        base_hourly_rate=1500,
        base_day_use_rate=4500,
        base_nightly_rate=7500,
        base_daily_rate=7500,
        extra_hour_rate=750,
        extra_guest_rate=750,
    )
    rt_family = RoomType(
        property_id=property1.id,
        name="Family Suite",
        description="Large family suite with separate living area",
        is_ac=True,
        max_guests=4,
        base_hourly_rate=2000,
        base_day_use_rate=6000,
        base_nightly_rate=10000,
        base_daily_rate=10000,
        extra_hour_rate=1000,
        extra_guest_rate=1000,
    )
    db.add_all([rt_std_nonac, rt_std_ac, rt_deluxe, rt_family])
    await db.flush()

    # Add amenities to room types
    for rt in [rt_std_nonac, rt_std_ac, rt_deluxe, rt_family]:
        db.add(RoomAmenity(room_type_id=rt.id, amenity_id=amenities["WiFi"].id))
        db.add(RoomAmenity(room_type_id=rt.id, amenity_id=amenities["Hot Water"].id))
        db.add(RoomAmenity(room_type_id=rt.id, amenity_id=amenities["TV"].id))
    for rt in [rt_std_ac, rt_deluxe, rt_family]:
        db.add(RoomAmenity(room_type_id=rt.id, amenity_id=amenities["Air Conditioning"].id))
    for rt in [rt_deluxe, rt_family]:
        db.add(RoomAmenity(room_type_id=rt.id, amenity_id=amenities["Minibar"].id))
        db.add(RoomAmenity(room_type_id=rt.id, amenity_id=amenities["Safe"].id))

    print("  ✓ Room types (Standard Non-AC, Standard AC, Deluxe, Family Suite)")

    # -------------------------------------------------------------------------
    # Rooms (8 rooms)
    # -------------------------------------------------------------------------
    rooms_config = [
        ("101", "1", rt_std_nonac, 2),
        ("102", "1", rt_std_nonac, 2),
        ("103", "1", rt_std_ac, 2),
        ("104", "1", rt_std_ac, 2),
        ("201", "2", rt_deluxe, 2),
        ("202", "2", rt_deluxe, 2),
        ("203", "2", rt_family, 4),
        ("204", "2", rt_family, 4),
    ]
    rooms = {}
    for room_num, floor, rt, max_g in rooms_config:
        r = Room(
            property_id=property1.id,
            room_type_id=rt.id,
            room_number=room_num,
            floor=floor,
            max_guests=max_g,
            status=RoomStatusEnum.AVAILABLE,
        )
        db.add(r)
        rooms[room_num] = r
    await db.flush()
    print(f"  ✓ Rooms: {', '.join(rooms.keys())}")

    # -------------------------------------------------------------------------
    # Services
    # -------------------------------------------------------------------------
    services_data = [
        (ServiceCategoryEnum.FOOD, "Breakfast", "Full English breakfast", 600),
        (ServiceCategoryEnum.FOOD, "Dinner", "Set dinner menu", 1200),
        (ServiceCategoryEnum.FOOD, "Room Service - Sandwich", "Sandwich and chips", 450),
        (ServiceCategoryEnum.DRINK, "Soft Drink", "Coca-Cola / Sprite / Fanta", 200),
        (ServiceCategoryEnum.DRINK, "Fresh Juice", "Orange / Mango / Pineapple", 350),
        (ServiceCategoryEnum.MINIBAR, "Beer (Lion)", "330ml can", 450),
        (ServiceCategoryEnum.MINIBAR, "Mineral Water", "750ml bottle", 150),
        (ServiceCategoryEnum.LAUNDRY, "Shirt Ironing", "Per shirt", 100),
        (ServiceCategoryEnum.LAUNDRY, "Laundry - Per Kg", "Washed and folded", 300),
        (ServiceCategoryEnum.ROOM_SERVICE, "Extra Towels", "Set of 2 towels", 200),
        (ServiceCategoryEnum.OTHER, "Airport Transfer", "One-way to BIA", 5000),
    ]
    services = {}
    for cat, name, desc, price in services_data:
        s = Service(property_id=property1.id, category=cat, name=name, description=desc, unit_price=price)
        db.add(s)
        services[name] = s
    await db.flush()
    print(f"  ✓ Services: {len(services_data)} services")

    # -------------------------------------------------------------------------
    # Guests
    # -------------------------------------------------------------------------
    guests_data = [
        ("Kamal Fernando", "+94 77 234 5678", "kamal@example.com", "Sri Lanka"),
        ("Emma Thompson", "+44 7890 123 456", "emma.t@example.co.uk", "United Kingdom"),
        ("Rajesh Kumar", "+91 98765 43210", "rajesh.k@example.in", "India"),
        ("Li Wei", "+86 138 0013 8000", "liwei@example.cn", "China"),
        ("Ahmed Hassan", "+971 50 234 5678", "ahmed@example.ae", "UAE"),
        ("Maria Garcia", "+34 612 345 678", "maria@example.es", "Spain"),
    ]
    guests = []
    for name, phone, email, country in guests_data:
        g = Guest(
            organization_id=org.id,
            full_name=name,
            phone=phone,
            email=email,
            address=country,
        )
        db.add(g)
        guests.append(g)
    await db.flush()
    print(f"  ✓ Guests: {len(guests)} profiles")

    # -------------------------------------------------------------------------
    # Historical Stays (completed, with invoices and payments)
    # -------------------------------------------------------------------------
    now = datetime.now(timezone.utc)

    historical_stays = [
        # Room 101 — completed overnight stay
        {
            "room": rooms["101"],
            "guest": guests[0],
            "stay_type": StayTypeEnum.OVERNIGHT,
            "check_in": now - timedelta(days=5, hours=4),
            "expected_checkout": now - timedelta(days=4, hours=17),
            "actual_checkout": now - timedelta(days=4, hours=16, minutes=45),
            "room_charge": 4000,
            "paid": 4000,
            "payment_method": PaymentMethodEnum.CASH,
        },
        # Room 103 — completed 3-night daily stay
        {
            "room": rooms["103"],
            "guest": guests[1],
            "stay_type": StayTypeEnum.DAILY,
            "check_in": now - timedelta(days=10),
            "expected_checkout": now - timedelta(days=7),
            "actual_checkout": now - timedelta(days=7, hours=1),
            "room_charge": 15000,
            "paid": 15000,
            "payment_method": PaymentMethodEnum.CARD,
            "services": [
                (services["Breakfast"], 3),
                (services["Soft Drink"], 6),
            ],
        },
        # Room 201 — completed day-use
        {
            "room": rooms["201"],
            "guest": guests[2],
            "stay_type": StayTypeEnum.DAY_USE,
            "check_in": now - timedelta(days=2, hours=8),
            "expected_checkout": now - timedelta(days=2) + timedelta(hours=18),
            "actual_checkout": now - timedelta(days=2) + timedelta(hours=18, minutes=15),
            "room_charge": 4500,
            "paid": 4500,
            "payment_method": PaymentMethodEnum.BANK_TRANSFER,
        },
    ]

    for s_data in historical_stays:
        room = s_data["room"]
        stay = Stay(
            property_id=property1.id,
            room_id=room.id,
            primary_guest_id=s_data["guest"].id,
            stay_type=s_data["stay_type"],
            actual_check_in=s_data["check_in"],
            expected_checkout=s_data["expected_checkout"],
            actual_checkout=s_data["actual_checkout"],
            num_guests=1,
            checked_in_by=receptionist.id,
            checked_out_by=receptionist.id,
            is_completed=True,
        )
        db.add(stay)
        await db.flush()

        folio = Folio(stay_id=stay.id, is_finalized=True, finalized_at=s_data["actual_checkout"])
        db.add(folio)
        await db.flush()

        services_total = 0
        for svc, qty in s_data.get("services", []):
            total = svc.unit_price * qty
            services_total += total
            db.add(FolioItem(
                folio_id=folio.id,
                category=svc.category.value,
                description=svc.name,
                quantity=qty,
                unit_price=svc.unit_price,
                total=total,
                created_by=receptionist.id,
            ))

        grand_total = s_data["room_charge"] + services_total

        import random, string
        inv_num = f"INV-{s_data['check_in'].strftime('%Y%m%d')}-{''.join(random.choices(string.digits, k=6))}"
        invoice = Invoice(
            invoice_number=inv_num,
            folio_id=folio.id,
            stay_id=stay.id,
            guest_id=s_data["guest"].id,
            room_charge=s_data["room_charge"],
            services_total=services_total,
            grand_total=grand_total,
            is_finalized=True,
            finalized_at=s_data["actual_checkout"],
        )
        db.add(invoice)
        await db.flush()

        payment = Payment(
            invoice_id=invoice.id,
            payment_method=s_data["payment_method"],
            amount=s_data["paid"],
            created_by=receptionist.id,
        )
        db.add(payment)

    print(f"  ✓ Historical stays: {len(historical_stays)} completed stays with invoices")

    # -------------------------------------------------------------------------
    # Active Stays (currently occupied rooms)
    # -------------------------------------------------------------------------
    # Room 102 — hourly stay checked in 2 hours ago, expected out in 1 hour
    active_stay_102 = Stay(
        property_id=property1.id,
        room_id=rooms["102"].id,
        primary_guest_id=guests[3].id,
        stay_type=StayTypeEnum.HOURLY,
        actual_check_in=now - timedelta(hours=2),
        expected_checkout=now + timedelta(hours=1),
        num_guests=1,
        checked_in_by=receptionist.id,
        is_completed=False,
    )
    db.add(active_stay_102)
    rooms["102"].status = RoomStatusEnum.OCCUPIED

    active_stay_203 = Stay(
        property_id=property1.id,
        room_id=rooms["203"].id,
        primary_guest_id=guests[4].id,
        stay_type=StayTypeEnum.OVERNIGHT,
        actual_check_in=now - timedelta(hours=3),
        expected_checkout=now + timedelta(hours=20),
        num_guests=3,
        checked_in_by=receptionist.id,
        is_completed=False,
    )
    db.add(active_stay_203)
    rooms["203"].status = RoomStatusEnum.OCCUPIED
    await db.flush()

    # Create folios for active stays
    folio_102 = Folio(stay_id=active_stay_102.id)
    folio_203 = Folio(stay_id=active_stay_203.id)
    db.add_all([folio_102, folio_203])
    await db.flush()

    # Add some services to room 203 folio
    for svc_name, qty in [("Breakfast", 3), ("Soft Drink", 3)]:
        svc = services[svc_name]
        total = svc.unit_price * qty
        db.add(FolioItem(
            folio_id=folio_203.id,
            category=svc.category.value,
            description=svc.name,
            quantity=qty,
            unit_price=svc.unit_price,
            total=total,
            created_by=receptionist.id,
        ))

    print("  ✓ Active stays: Room 102 (hourly), Room 203 (overnight)")

    # -------------------------------------------------------------------------
    # Upcoming Reservations
    # -------------------------------------------------------------------------
    upcoming = [
        {
            "room": rooms["104"],
            "guest": guests[5],
            "stay_type": StayTypeEnum.OVERNIGHT,
            "check_in_date": date.today() + timedelta(days=1),
            "checkout_date": date.today() + timedelta(days=2),
            "source": BookingSourceEnum.PHONE,
        },
        {
            "room": rooms["202"],
            "guest": guests[0],
            "stay_type": StayTypeEnum.DAILY,
            "check_in_date": date.today() + timedelta(days=3),
            "checkout_date": date.today() + timedelta(days=6),
            "source": BookingSourceEnum.WEBSITE,
        },
    ]

    import string as _string

    for r_data in upcoming:
        suffix = "".join(random.choices(_string.ascii_uppercase + _string.digits, k=6))
        res = Reservation(
            reservation_number=f"SF-{date.today().strftime('%Y%m%d')}-{suffix}",
            property_id=property1.id,
            room_id=r_data["room"].id,
            primary_guest_id=r_data["guest"].id,
            stay_type=r_data["stay_type"],
            check_in_date=r_data["check_in_date"],
            expected_checkout_date=r_data["checkout_date"],
            num_guests=1,
            booking_source=r_data["source"],
            status=ReservationStatusEnum.CONFIRMED,
            created_by=receptionist.id,
        )
        db.add(res)
        r_data["room"].status = RoomStatusEnum.RESERVED

    print(f"  ✓ Upcoming reservations: {len(upcoming)}")

    # -------------------------------------------------------------------------
    # Room 104 in CLEANING
    # -------------------------------------------------------------------------
    rooms["104"].status = RoomStatusEnum.CLEANING
    hk_task = HousekeepingTask(
        property_id=property1.id,
        room_id=rooms["104"].id,
        assigned_to=housekeeper.id,
        status=HousekeepingStatusEnum.PENDING,
        priority=HousekeepingPriorityEnum.NORMAL,
        notes="Post-checkout cleaning",
    )
    db.add(hk_task)
    print("  ✓ Housekeeping task for Room 104")

    await db.commit()
    print("\n✅ Seed completed successfully!")
    print("\n📋 Demo Credentials (LOCAL DEV ONLY):")
    print("  Owner:        owner@stayflow.demo        / Demo@12345!")
    print("  Manager:      manager@stayflow.demo      / Demo@12345!")
    print("  Receptionist: reception@stayflow.demo    / Demo@12345!")
    print("  Housekeeper:  housekeeper@stayflow.demo  / Demo@12345!")
    print(f"\n🏨 Organization: StayFlow Demo Hospitality")
    print(f"🏠 Property: Colombo Guest House (8 rooms)")


async def main():
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as db:
        await seed(db)

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
