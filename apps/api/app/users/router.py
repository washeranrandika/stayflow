"""Users router."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.core.database import get_db
from app.core.dependencies import get_current_user, CurrentUser
from app.core.responses import success

router = APIRouter()


@router.get("/me", response_model=dict)
async def get_me(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    u = current_user.user
    return success(data={
        "id": str(u.id),
        "email": u.email,
        "full_name": u.full_name,
        "phone": u.phone,
        "is_active": u.is_active,
        "role": current_user.role.value,
        "organization_id": str(current_user.organization_id),
        "organization_name": current_user.organization.name,
        "created_at": u.created_at.isoformat(),
    })
