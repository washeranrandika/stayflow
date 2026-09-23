"""Auth router."""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.rate_limit import limiter
from app.auth.schemas import LoginRequest, LoginResponse, TokenResponse, RefreshRequest
from app.auth.service import auth_service
from app.core.responses import success

router = APIRouter()


@router.post("/login", response_model=dict)
@limiter.limit("10/minute")
async def login(request: Request, body: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate user and return JWT tokens."""
    result = await auth_service.login(db, body.email, body.password, request)
    return success(data=result.model_dump(), message="Login successful")


@router.post("/refresh", response_model=dict)
@limiter.limit("20/minute")
async def refresh(request: Request, body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    """Exchange a refresh token for new access + refresh tokens."""
    tokens = await auth_service.refresh(db, body.refresh_token)
    return success(data=tokens.model_dump(), message="Token refreshed")


@router.post("/logout", response_model=dict)
async def logout(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    """Revoke a refresh token (logout)."""
    await auth_service.logout(db, body.refresh_token)
    return success(message="Logged out successfully")
