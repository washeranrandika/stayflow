"""Users & Profile settings router."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.core.dependencies import get_current_user, CurrentUser
from app.core.models import User
from app.core.responses import success
from app.core.security import verify_password, hash_password
from app.audit.service import audit_log

router = APIRouter()


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=200)
    phone: Optional[str] = Field(None, max_length=50)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8, description="Minimum 8 characters")


@router.get("/me", response_model=dict)
async def get_me(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get current user's profile and organization details."""
    u = current_user.user
    return success(data={
        "id": str(u.id),
        "email": u.email,
        "full_name": u.full_name,
        "phone": u.phone,
        "is_active": u.is_active,
        "role": current_user.role.value,
        "assigned_property_id": str(current_user.property_id) if current_user.property_id else None,
        "assigned_property_name": current_user.property_name,
        "organization_id": str(current_user.organization_id),
        "organization_name": current_user.organization.name,
        "created_at": u.created_at.isoformat(),
    })


@router.patch("/me", response_model=dict)
async def update_profile(
    body: UpdateProfileRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Update profile information (full_name, phone)."""
    user = await db.get(User, current_user.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    old_values = {"full_name": user.full_name, "phone": user.phone}

    if body.full_name is not None:
        user.full_name = body.full_name.strip()
    if body.phone is not None:
        user.phone = body.phone.strip()

    await audit_log(
        db,
        action="user.update_profile",
        entity_type="user",
        entity_id=str(user.id),
        organization_id=current_user.organization_id,
        user_id=current_user.user_id,
        old_values=old_values,
        new_values={"full_name": user.full_name, "phone": user.phone},
    )

    await db.commit()
    await db.refresh(user)

    return success(
        data={
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "phone": user.phone,
            "is_active": user.is_active,
            "role": current_user.role.value,
            "organization_id": str(current_user.organization_id),
            "organization_name": current_user.organization.name,
        },
        message="Profile updated successfully",
    )


@router.post("/me/change-password", response_model=dict)
async def change_password(
    body: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Change current user's password."""
    user = await db.get(User, current_user.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_PASSWORD", "message": "Current password is incorrect"},
        )

    user.password_hash = hash_password(body.new_password)

    await audit_log(
        db,
        action="user.change_password",
        entity_type="user",
        entity_id=str(user.id),
        organization_id=current_user.organization_id,
        user_id=current_user.user_id,
    )

    await db.commit()
    return success(message="Password changed successfully")
