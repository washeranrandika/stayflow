from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from contextlib import asynccontextmanager
import structlog

from app.core.config import settings
from app.core.database import engine, Base
from app.core.middleware import AuditMiddleware, RequestIDMiddleware
from app.core.rate_limit import limiter, rate_limit_handler
from slowapi.errors import RateLimitExceeded

# Import all routers
from app.auth.router import router as auth_router
from app.organizations.router import router as org_router
from app.properties.router import router as properties_router
from app.users.router import router as users_router
from app.rooms.router import router as rooms_router
from app.room_types.router import router as room_types_router
from app.guests.router import router as guests_router
from app.identity.router import router as identity_router
from app.reservations.router import router as reservations_router
from app.stays.router import router as stays_router
from app.billing.router import router as billing_router
from app.payments.router import router as payments_router
from app.services.router import router as services_router
from app.housekeeping.router import router as housekeeping_router
from app.notifications.router import router as notifications_router
from app.reports.router import router as reports_router
from app.audit.router import router as audit_router
from app.subscriptions.router import router as subscriptions_router

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting StayFlow API", version=settings.APP_VERSION)
    yield
    logger.info("Shutting down StayFlow API")


def create_application() -> FastAPI:
    app = FastAPI(
        title="StayFlow API",
        description="Multi-tenant Guest House Property Management System API",
        version=settings.APP_VERSION,
        docs_url="/api/docs" if settings.DEBUG else None,
        redoc_url="/api/redoc" if settings.DEBUG else None,
        openapi_url="/api/openapi.json" if settings.DEBUG else None,
        lifespan=lifespan,
    )

    # Rate limiting
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, rate_limit_handler)

    # Middleware (order matters — innermost first)
    app.add_middleware(RequestIDMiddleware)
    app.add_middleware(AuditMiddleware)

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Trusted hosts (security in production)
    if not settings.DEBUG:
        app.add_middleware(
            TrustedHostMiddleware,
            allowed_hosts=settings.ALLOWED_HOSTS,
        )

    # Register all routers under /api/v1
    prefix = settings.API_PREFIX

    app.include_router(auth_router, prefix=f"{prefix}/auth", tags=["Authentication"])
    app.include_router(org_router, prefix=f"{prefix}/organizations", tags=["Organizations"])
    app.include_router(properties_router, prefix=f"{prefix}/properties", tags=["Properties"])
    app.include_router(users_router, prefix=f"{prefix}/users", tags=["Users"])
    app.include_router(rooms_router, prefix=f"{prefix}/rooms", tags=["Rooms"])
    app.include_router(room_types_router, prefix=f"{prefix}/room-types", tags=["Room Types"])
    app.include_router(guests_router, prefix=f"{prefix}/guests", tags=["Guests"])
    app.include_router(identity_router, prefix=f"{prefix}/identity", tags=["Identity"])
    app.include_router(reservations_router, prefix=f"{prefix}/bookings", tags=["Reservations"])
    app.include_router(reservations_router, prefix=f"{prefix}/reservations", tags=["Reservations"])
    app.include_router(stays_router, prefix=f"{prefix}/stays", tags=["Stays"])
    app.include_router(billing_router, prefix=f"{prefix}/billing", tags=["Billing"])
    app.include_router(payments_router, prefix=f"{prefix}/payments", tags=["Payments"])
    app.include_router(services_router, prefix=f"{prefix}/services", tags=["Services"])
    app.include_router(housekeeping_router, prefix=f"{prefix}/housekeeping", tags=["Housekeeping"])
    app.include_router(notifications_router, prefix=f"{prefix}/notifications", tags=["Notifications"])
    app.include_router(reports_router, prefix=f"{prefix}/reports", tags=["Reports"])
    app.include_router(audit_router, prefix=f"{prefix}/audit", tags=["Audit"])
    app.include_router(subscriptions_router, prefix=f"{prefix}/subscriptions", tags=["Subscriptions"])

    @app.get(f"{prefix}/health", tags=["Health"])
    async def health_check():
        return {"status": "healthy", "version": settings.APP_VERSION}

    return app

app = create_application()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
