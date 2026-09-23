"""Rate limiting configuration using slowapi."""
from slowapi import Limiter
from slowapi.util import get_remote_address
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)


async def rate_limit_handler(request: Request, exc: RateLimitExceeded) -> Response:
    return JSONResponse(
        status_code=429,
        content={
            "success": False,
            "error": {
                "code": "RATE_LIMIT_EXCEEDED",
                "message": "Too many requests. Please slow down.",
            },
        },
    )
