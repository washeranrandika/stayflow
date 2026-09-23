"""
Middleware: Request ID injection, audit logging preparation.
"""
import uuid
import time
import structlog
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = structlog.get_logger()


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Inject a unique X-Request-ID header into every request and response."""

    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id

        start_time = time.perf_counter()
        response = await call_next(request)
        process_time = time.perf_counter() - start_time

        response.headers["X-Request-ID"] = request_id
        response.headers["X-Process-Time"] = f"{process_time:.4f}s"

        logger.info(
            "request_completed",
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            process_time=f"{process_time:.4f}s",
        )

        return response


class AuditMiddleware(BaseHTTPMiddleware):
    """
    Captures request metadata (IP, user agent) and attaches to request state
    for use by audit log service.
    """

    async def dispatch(self, request: Request, call_next):
        # Extract real IP (handle proxy headers)
        forwarded_for = request.headers.get("X-Forwarded-For")
        request.state.ip_address = (
            forwarded_for.split(",")[0].strip() if forwarded_for
            else request.client.host if request.client else None
        )
        request.state.user_agent = request.headers.get("User-Agent")

        response = await call_next(request)
        return response
