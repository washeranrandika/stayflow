"""
Tests for Authentication, RBAC permissions, and Audit Logging.
"""
import pytest
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.models import User, Organization, OrganizationMember, UserRoleEnum, AuditLog
from app.core.security import hash_password, verify_password, create_access_token, decode_access_token
from app.core.permissions import has_permission, Permission, ROLE_PERMISSIONS
from app.audit.service import audit_log


@pytest.mark.asyncio
async def test_password_hashing_and_verification():
    raw_pass = "SecureSecret!2026"
    hashed = hash_password(raw_pass)
    assert hashed != raw_pass
    assert verify_password(raw_pass, hashed) is True
    assert verify_password("WrongPassword!", hashed) is False


@pytest.mark.asyncio
async def test_jwt_generation_and_decoding():
    user_id = str(uuid.uuid4())
    org_id = str(uuid.uuid4())
    token = create_access_token({"sub": user_id, "org_id": org_id, "role": "OWNER"})
    payload = decode_access_token(token)
    assert payload["sub"] == user_id
    assert payload["org_id"] == org_id
    assert payload["role"] == "OWNER"


@pytest.mark.asyncio
async def test_rbac_permissions_matrix():
    # OWNER has all permissions
    assert has_permission(UserRoleEnum.OWNER, Permission.PROPERTY_UPDATE) is True
    assert has_permission(UserRoleEnum.OWNER, Permission.AUDIT_VIEW) is True
    assert has_permission(UserRoleEnum.OWNER, Permission.STAFF_MANAGE) is True

    # RECEPTIONIST can check-in / check-out, view bookings, but cannot manage staff or delete org
    assert has_permission(UserRoleEnum.RECEPTIONIST, Permission.STAY_CHECKIN) is True
    assert has_permission(UserRoleEnum.RECEPTIONIST, Permission.STAY_CHECKOUT) is True
    assert has_permission(UserRoleEnum.RECEPTIONIST, Permission.BOOKING_CREATE) is True
    assert has_permission(UserRoleEnum.RECEPTIONIST, Permission.STAFF_MANAGE) is False
    assert has_permission(UserRoleEnum.RECEPTIONIST, Permission.ORG_SETTINGS) is False

    # HOUSEKEEPER can view housekeeping and update room status, but cannot create bookings or invoices
    assert has_permission(UserRoleEnum.HOUSEKEEPER, Permission.HOUSEKEEPING_UPDATE) is True
    assert has_permission(UserRoleEnum.HOUSEKEEPER, Permission.ROOM_STATUS_UPDATE) is True
    assert has_permission(UserRoleEnum.HOUSEKEEPER, Permission.BOOKING_CREATE) is False
    assert has_permission(UserRoleEnum.HOUSEKEEPER, Permission.INVOICE_CREATE) is False


@pytest.mark.asyncio
async def test_audit_logging(db: AsyncSession, org, owner_user):
    user, member = owner_user

    await audit_log(
        db=db,
        action="room.status.update",
        entity_type="room",
        entity_id=str(uuid.uuid4()),
        organization_id=org.id,
        user_id=user.id,
        old_values={"status": "AVAILABLE"},
        new_values={"status": "OCCUPIED"},
    )
    await db.flush()

    # Verify audit log was recorded
    result = await db.execute(
        select(AuditLog).where(
            AuditLog.organization_id == org.id,
            AuditLog.action == "room.status.update",
        )
    )
    entry = result.scalar_one_or_none()
    assert entry is not None
    assert entry.user_id == user.id
    assert entry.old_values == {"status": "AVAILABLE"}
    assert entry.new_values == {"status": "OCCUPIED"}
