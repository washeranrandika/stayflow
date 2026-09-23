"""
Auth service — login, refresh, logout business logic.
"""
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.core.models import User, RefreshToken, OrganizationMember, Organization, UserRoleEnum, Property
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    hash_token,
    decode_access_token,
)
from app.core.config import settings
from app.auth.schemas import TokenResponse, UserResponse, LoginResponse
from app.audit.service import audit_log


class AuthService:

    async def login(
        self,
        db: AsyncSession,
        email: str,
        password: str,
        request: Optional[Request] = None,
    ) -> LoginResponse:
        # Find user
        result = await db.execute(select(User).where(User.email == email.lower()))
        user = result.scalar_one_or_none()

        if not user or not verify_password(password, user.hashed_password):
            await audit_log(
                db=db,
                action="auth.login_failed",
                entity_type="user",
                entity_id=email,
                ip_address=getattr(request.state, "ip_address", None) if request else None,
                user_agent=getattr(request.state, "user_agent", None) if request else None,
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"code": "INVALID_CREDENTIALS", "message": "Invalid email or password"},
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "ACCOUNT_INACTIVE", "message": "Account is inactive"},
            )

        # Get primary org membership (most recently active)
        from sqlalchemy.orm import selectinload
        result = await db.execute(
            select(OrganizationMember)
            .options(selectinload(OrganizationMember.property))
            .where(
                OrganizationMember.user_id == user.id,
                OrganizationMember.is_active == True,
            )
            .order_by(OrganizationMember.created_at.desc())
            .limit(1)
        )
        member = result.scalar_one_or_none()
        if not member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "NO_ORG", "message": "User is not a member of any organization"},
            )

        # Create tokens
        access_token = create_access_token({
            "sub": str(user.id),
            "org_id": str(member.organization_id),
            "role": member.role.value,
        })
        raw_refresh, hashed_refresh = create_refresh_token()

        # Store refresh token
        refresh_token_obj = RefreshToken(
            user_id=user.id,
            token_hash=hashed_refresh,
            expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
            ip_address=getattr(request.state, "ip_address", None) if request else None,
            user_agent=getattr(request.state, "user_agent", None) if request else None,
        )
        db.add(refresh_token_obj)

        # Update last login
        await db.execute(
            update(User)
            .where(User.id == user.id)
            .values(last_login_at=datetime.now(timezone.utc))
        )

        await audit_log(
            db=db,
            action="auth.login",
            entity_type="user",
            entity_id=str(user.id),
            organization_id=member.organization_id,
            user_id=user.id,
            ip_address=getattr(request.state, "ip_address", None) if request else None,
            user_agent=getattr(request.state, "user_agent", None) if request else None,
        )

        await db.commit()

        user_resp = UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            phone=user.phone,
            role=member.role.value,
            assigned_property_id=member.property_id,
            assigned_property_name=member.property.name if getattr(member, "property", None) else None,
            is_active=user.is_active,
            created_at=user.created_at,
        )

        return LoginResponse(
            tokens=TokenResponse(
                access_token=access_token,
                refresh_token=raw_refresh,
                expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            ),
            user=user_resp,
        )

    async def refresh(self, db: AsyncSession, refresh_token: str) -> TokenResponse:
        hashed = hash_token(refresh_token)

        result = await db.execute(
            select(RefreshToken).where(
                RefreshToken.token_hash == hashed,
                RefreshToken.is_revoked == False,
            )
        )
        token_obj = result.scalar_one_or_none()

        if not token_obj or token_obj.expires_at < datetime.now(timezone.utc):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"code": "INVALID_REFRESH_TOKEN", "message": "Invalid or expired refresh token"},
            )

        # Revoke old token (rotation)
        token_obj.is_revoked = True

        # Get user and membership
        result = await db.execute(select(User).where(User.id == token_obj.user_id))
        user = result.scalar_one_or_none()
        if not user or not user.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User inactive")

        result = await db.execute(
            select(OrganizationMember)
            .where(OrganizationMember.user_id == user.id, OrganizationMember.is_active == True)
            .order_by(OrganizationMember.created_at.desc())
            .limit(1)
        )
        member = result.scalar_one_or_none()
        if not member:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No active membership")

        # Issue new tokens
        access_token = create_access_token({
            "sub": str(user.id),
            "org_id": str(member.organization_id),
            "role": member.role.value,
        })
        raw_refresh, hashed_refresh = create_refresh_token()

        new_token = RefreshToken(
            user_id=user.id,
            token_hash=hashed_refresh,
            expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        )
        db.add(new_token)
        await db.commit()

        return TokenResponse(
            access_token=access_token,
            refresh_token=raw_refresh,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    async def logout(self, db: AsyncSession, refresh_token: str) -> None:
        hashed = hash_token(refresh_token)
        result = await db.execute(
            select(RefreshToken).where(RefreshToken.token_hash == hashed)
        )
        token_obj = result.scalar_one_or_none()
        if token_obj:
            token_obj.is_revoked = True
            await db.commit()

    async def register(
        self,
        db: AsyncSession,
        full_name: str,
        email: str,
        password: str,
        hotel_name: Optional[str] = None,
        phone: Optional[str] = None,
        request: Optional[Request] = None,
    ) -> LoginResponse:
        import re
        email = email.lower().strip()

        # Check if user already exists
        result = await db.execute(select(User).where(User.email == email))
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "EMAIL_EXISTS", "message": "An account with this email already exists"},
            )

        # Generate org name & slug
        org_name = hotel_name.strip() if hotel_name and hotel_name.strip() else f"{full_name.strip()}'s Property"
        slug_base = re.sub(r"[^a-z0-9]+", "-", org_name.lower()).strip("-") or "property"
        unique_slug = f"{slug_base}-{uuid.uuid4().hex[:6]}"

        # Create Organization
        organization = Organization(
            name=org_name,
            slug=unique_slug,
            email=email,
            phone=phone,
            currency="LKR",
        )
        db.add(organization)
        await db.flush()

        # Create User
        user = User(
            email=email,
            hashed_password=hash_password(password),
            full_name=full_name.strip(),
            phone=phone,
            is_active=True,
            last_login_at=datetime.now(timezone.utc),
        )
        db.add(user)
        await db.flush()

        # Create OrganizationMember (Role: OWNER)
        member = OrganizationMember(
            organization_id=organization.id,
            user_id=user.id,
            role=UserRoleEnum.OWNER,
            is_active=True,
        )
        db.add(member)

        # Create Default Property
        property_obj = Property(
            organization_id=organization.id,
            name=f"{org_name} Main",
            address="Main Street",
            city="Colombo",
            country="Sri Lanka",
            check_in_time="14:00",
            check_out_time="11:00",
            is_active=True,
        )
        db.add(property_obj)
        await db.flush()

        # Generate Tokens
        access_token = create_access_token({
            "sub": str(user.id),
            "org_id": str(organization.id),
            "role": UserRoleEnum.OWNER.value,
        })
        raw_refresh, hashed_refresh = create_refresh_token()

        refresh_token_obj = RefreshToken(
            user_id=user.id,
            token_hash=hashed_refresh,
            expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
            ip_address=getattr(request.state, "ip_address", None) if request else None,
            user_agent=getattr(request.state, "user_agent", None) if request else None,
        )
        db.add(refresh_token_obj)

        await audit_log(
            db=db,
            action="auth.register",
            entity_type="user",
            entity_id=str(user.id),
            organization_id=organization.id,
            user_id=user.id,
        )

        await db.commit()

        return LoginResponse(
            tokens=TokenResponse(
                access_token=access_token,
                refresh_token=raw_refresh,
                expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            ),
            user=UserResponse.model_validate(user),
        )


auth_service = AuthService()
