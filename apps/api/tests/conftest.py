"""
Pytest configuration — shared fixtures for all tests.
"""
import asyncio
import pytest
import uuid
from datetime import datetime, timezone
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import NullPool

from app.core.database import Base
from app.core.models import (
    Organization, User, OrganizationMember, Property, RoomType, Room, Guest,
    UserRoleEnum, RoomStatusEnum,
)
from app.core.config import settings
from app.core.security import hash_password
from app.core.celery_app import celery_app

# Eager mode for tests so Celery doesn't attempt Redis connection
celery_app.conf.update(task_always_eager=True, task_eager_propagates=True)


@pytest.fixture(scope="session")
def engine():
    return create_async_engine(settings.DATABASE_URL, poolclass=NullPool)


@pytest.fixture(scope="session", autouse=True)
async def setup_db(engine):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


@pytest.fixture
async def db(engine) -> AsyncGenerator[AsyncSession, None]:
    """Fresh DB session per test."""
    async_session = async_sessionmaker(engine, expire_on_commit=False)
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.rollback()
            await session.close()


@pytest.fixture
async def org(db: AsyncSession) -> Organization:
    org = Organization(
        name="Test Org",
        slug=f"test-org-{uuid.uuid4().hex[:8]}",
        timezone="UTC",
        currency="USD",
    )
    db.add(org)
    await db.flush()
    return org


@pytest.fixture
async def owner_user(db: AsyncSession, org: Organization):
    user = User(
        email=f"owner-{uuid.uuid4().hex[:8]}@test.com",
        full_name="Test Owner",
        hashed_password=hash_password("Test@1234!"),
    )
    db.add(user)
    await db.flush()
    member = OrganizationMember(organization_id=org.id, user_id=user.id, role=UserRoleEnum.OWNER)
    db.add(member)
    await db.flush()
    return user, member


@pytest.fixture
async def property1(db: AsyncSession, org: Organization):
    prop = Property(
        organization_id=org.id,
        name="Test Property",
        address="123 Test St",
        city="Colombo",
        country="Sri Lanka",
        timezone="Asia/Colombo",
    )
    db.add(prop)
    await db.flush()
    return prop


@pytest.fixture
async def room_type(db: AsyncSession, property1: Property):
    rt = RoomType(
        property_id=property1.id,
        name="Standard",
        is_ac=True,
        max_guests=2,
        base_hourly_rate=1000,
        base_day_use_rate=3000,
        base_nightly_rate=5000,
        base_daily_rate=5000,
        extra_hour_rate=500,
        extra_guest_rate=500,
    )
    db.add(rt)
    await db.flush()
    return rt


@pytest.fixture
async def available_room(db: AsyncSession, property1: Property, room_type: RoomType):
    room = Room(
        property_id=property1.id,
        room_type_id=room_type.id,
        room_number="101",
        max_guests=2,
        status=RoomStatusEnum.AVAILABLE,
    )
    db.add(room)
    await db.flush()
    return room


@pytest.fixture
async def guest(db: AsyncSession, org: Organization):
    g = Guest(
        organization_id=org.id,
        full_name="Test Guest",
        phone="+94771234567",
        email="guest@test.com",
    )
    db.add(g)
    await db.flush()
    return g
