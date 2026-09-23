"""
Standardized API response helpers.
All endpoints should use these for consistent response shapes.
"""
from typing import Any, Optional, TypeVar, Generic
from pydantic import BaseModel

T = TypeVar("T")


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: Optional[dict] = None


class PaginationMeta(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int


class SuccessResponse(BaseModel):
    success: bool = True
    data: Any = None
    message: Optional[str] = None
    meta: Optional[PaginationMeta] = None


class ErrorResponse(BaseModel):
    success: bool = False
    error: ErrorDetail


def success(data: Any = None, message: Optional[str] = None, meta: Optional[PaginationMeta] = None) -> dict:
    return {
        "success": True,
        "data": data,
        "message": message,
        "meta": meta,
    }


def paginated(
    data: Any,
    page: int,
    page_size: int,
    total: int,
) -> dict:
    import math
    return {
        "success": True,
        "data": data,
        "meta": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": math.ceil(total / page_size) if page_size > 0 else 0,
        },
    }
