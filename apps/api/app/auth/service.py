"""
Auth service — login, refresh, logout business logic.
"""
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.core.models import User, RefreshToken, OrganizationMember, Organization
from app.core.security import (
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
        result = await db.execute(
            select(OrganizationMember)
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

        return LoginResponse(
            tokens=TokenResponse(
                access_token=access_token,
                refresh_token=raw_refresh,
                expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            ),
            user=UserResponse.model_validate(user),
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


auth_service = AuthService()
