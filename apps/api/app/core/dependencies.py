"""
FastAPI dependencies for authentication, authorization, and tenant isolation.
These are the security gatekeepers used across all protected routes.
"""
import uuid
from typing import Optional, Annotated
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import decode_access_token
from app.core.models import User, OrganizationMember, Organization, UserRoleEnum
from app.core.permissions import Permission, ROLE_PERMISSIONS

bearer_scheme = HTTPBearer()


class CurrentUser:
    """Represents the authenticated user + their org context."""
    def __init__(
        self,
        user: User,
        member: OrganizationMember,
        organization: Organization,
    ):
        self.user = user
        self.member = member
        self.organization = organization

    @property
    def user_id(self) -> uuid.UUID:
        return self.user.id

    @property
    def organization_id(self) -> uuid.UUID:
        return self.organization.id

    @property
    def role(self) -> UserRoleEnum:
        return self.member.role

    @property
    def property_id(self) -> Optional[uuid.UUID]:
        return self.member.property_id

    @property
    def property_name(self) -> Optional[str]:
        return self.member.property.name if getattr(self.member, "property", None) else None

    def has_permission(self, permission: Permission) -> bool:
        """Check if the user's role has the given permission."""
        role_perms = ROLE_PERMISSIONS.get(self.role.value, [])
        return permission.value in role_perms


async def get_current_user_raw(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
    db: AsyncSession = Depends(get_db),
) -> User:
    """Validates JWT and returns the user. No org context."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(credentials.credentials)
        user_id: str = payload.get("sub")
        if not user_id:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise credentials_exception

    return user


async def get_current_user(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
    db: AsyncSession = Depends(get_db),
) -> "CurrentUser":
    """
    Full auth + tenant isolation dependency.
    Reads org from JWT claim and validates membership.
    NEVER trusts organization_id from request body/params.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(credentials.credentials)
        user_id: str = payload.get("sub")
        org_id: str = payload.get("org_id")
        if not user_id or not org_id:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # Validate user
    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise credentials_exception

    # Validate org membership (tenant isolation)
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(OrganizationMember)
        .options(selectinload(OrganizationMember.property))
        .where(
            OrganizationMember.user_id == user.id,
            OrganizationMember.organization_id == uuid.UUID(org_id),
            OrganizationMember.is_active == True,
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this organization",
        )

    # Load organization
    result = await db.execute(
        select(Organization).where(
            Organization.id == uuid.UUID(org_id),
            Organization.is_active == True,
        )
    )
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Organization not found or inactive",
        )

    return CurrentUser(user=user, member=member, organization=org)


def require_permission(permission: Permission):
    """
    Dependency factory that checks if the current user has the given permission.
    Usage: Depends(require_permission(Permission.ROOM_CREATE))
    """
    async def checker(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if not current_user.has_permission(permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: {permission.value}",
            )
        return current_user

    return checker


def require_role(*roles: UserRoleEnum):
    """Check that the user has one of the specified roles."""
    async def checker(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient role for this action",
            )
        return current_user

    return checker
