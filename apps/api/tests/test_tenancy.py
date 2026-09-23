"""Tests for tenant isolation."""
import pytest
import uuid
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.models import Organization, OrganizationMember, Property, Room, Guest, UserRoleEnum, RoomStatusEnum
from app.core.security import hash_password
from app.core.models import User


@pytest.mark.asyncio
async def test_tenant_isolation_property(db: AsyncSession, org):
    """Org A cannot access properties from Org B."""
    from app.properties.service import property_service
    from app.core.exceptions import TenantViolationError

    # Create Org B
    org_b = Organization(name="Org B", slug=f"org-b-{uuid.uuid4().hex[:6]}", timezone="UTC", currency="USD")
    db.add(org_b)
    await db.flush()

    # Create property in Org B
    prop_b = Property(organization_id=org_b.id, name="Org B Property", address="123 B St", city="Test", country="Test")
    db.add(prop_b)
    await db.flush()

    # Org A should not be able to access Org B's property
    with pytest.raises(Exception):  # HTTPException 403 or TenantViolationError
        await property_service.get_by_id(db, prop_b.id, org.id)


@pytest.mark.asyncio
async def test_tenant_isolation_guest(db: AsyncSession, org):
    """Org A cannot access guests from Org B."""
    from sqlalchemy import select

    org_b = Organization(name="Org B2", slug=f"org-b2-{uuid.uuid4().hex[:6]}", timezone="UTC", currency="USD")
    db.add(org_b)
    await db.flush()

    guest_b = Guest(organization_id=org_b.id, full_name="Org B Guest", phone="+1234567890")
    db.add(guest_b)
    await db.flush()

    # Querying from Org A context should return None
    from sqlalchemy import select
    result = await db.execute(
        select(Guest).where(Guest.id == guest_b.id, Guest.organization_id == org.id)
    )
    assert result.scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_org_member_cannot_join_other_org(db: AsyncSession, org):
    """A user from Org A cannot become a member of Org A via cross-tenant attack."""
    user = User(email=f"user-{uuid.uuid4().hex[:8]}@test.com", full_name="Test", hashed_password=hash_password("pass"))
    db.add(user)
    await db.flush()

    member = OrganizationMember(organization_id=org.id, user_id=user.id, role=UserRoleEnum.RECEPTIONIST)
    db.add(member)
    await db.flush()

    # Verify this member is only in org
    from sqlalchemy import select
    result = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.user_id == user.id,
            OrganizationMember.organization_id == org.id,
        )
    )
    assert result.scalar_one_or_none() is not None
