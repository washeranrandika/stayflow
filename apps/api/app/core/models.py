"""
All SQLAlchemy models for StayFlow.
Organized by domain.
"""
import uuid
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List
import enum

from sqlalchemy import (
    String, Boolean, Integer, Numeric, Text, Date, DateTime,
    ForeignKey, UniqueConstraint, CheckConstraint, Index, JSON,
    Enum as SAEnum, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.core.database import Base
from app.core.base_model import UUIDMixin, TimestampMixin


# =============================================================================
# Enums
# =============================================================================

class UserRoleEnum(str, enum.Enum):
    OWNER = "OWNER"
    MANAGER = "MANAGER"
    RECEPTIONIST = "RECEPTIONIST"
    HOUSEKEEPER = "HOUSEKEEPER"


class RoomStatusEnum(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    RESERVED = "RESERVED"
    OCCUPIED = "OCCUPIED"
    CLEANING = "CLEANING"
    MAINTENANCE = "MAINTENANCE"
    OUT_OF_SERVICE = "OUT_OF_SERVICE"


class StayTypeEnum(str, enum.Enum):
    HOURLY = "HOURLY"
    DAY_USE = "DAY_USE"
    OVERNIGHT = "OVERNIGHT"
    DAILY = "DAILY"


class ReservationStatusEnum(str, enum.Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    CHECKED_IN = "CHECKED_IN"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    NO_SHOW = "NO_SHOW"


class BookingSourceEnum(str, enum.Enum):
    WALK_IN = "WALK_IN"
    PHONE = "PHONE"
    WHATSAPP = "WHATSAPP"
    WEBSITE = "WEBSITE"
    OTA = "OTA"
    OTHER = "OTHER"


class PaymentMethodEnum(str, enum.Enum):
    CASH = "CASH"
    CARD = "CARD"
    BANK_TRANSFER = "BANK_TRANSFER"
    QR = "QR"
    ONLINE = "ONLINE"


class DocumentTypeEnum(str, enum.Enum):
    NATIONAL_ID = "NATIONAL_ID"
    PASSPORT = "PASSPORT"
    DRIVING_LICENCE = "DRIVING_LICENCE"


class VerificationStatusEnum(str, enum.Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    REJECTED = "REJECTED"


class HousekeepingStatusEnum(str, enum.Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"


class HousekeepingPriorityEnum(str, enum.Enum):
    LOW = "LOW"
    NORMAL = "NORMAL"
    HIGH = "HIGH"
    URGENT = "URGENT"


class ServiceCategoryEnum(str, enum.Enum):
    FOOD = "FOOD"
    DRINK = "DRINK"
    MINIBAR = "MINIBAR"
    LAUNDRY = "LAUNDRY"
    ROOM_SERVICE = "ROOM_SERVICE"
    OTHER = "OTHER"


class NotificationEventEnum(str, enum.Enum):
    NEW_BOOKING = "NEW_BOOKING"
    CHECK_IN_REMINDER = "CHECK_IN_REMINDER"
    CHECKOUT_APPROACHING = "CHECKOUT_APPROACHING"
    CHECKOUT_OVERDUE = "CHECKOUT_OVERDUE"
    PAYMENT_PENDING = "PAYMENT_PENDING"
    ROOM_READY = "ROOM_READY"
    HOUSEKEEPING_ASSIGNED = "HOUSEKEEPING_ASSIGNED"


# =============================================================================
# Organizations & Users
# =============================================================================

class Organization(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    email: Mapped[Optional[str]] = mapped_column(String(255))
    phone: Mapped[Optional[str]] = mapped_column(String(50))
    address: Mapped[Optional[str]] = mapped_column(Text)
    timezone: Mapped[str] = mapped_column(String(100), default="UTC", nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="USD", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    members: Mapped[List["OrganizationMember"]] = relationship(back_populates="organization", cascade="all, delete-orphan")
    properties: Mapped[List["Property"]] = relationship(back_populates="organization")
    guests: Mapped[List["Guest"]] = relationship(back_populates="organization")
    audit_logs: Mapped[List["AuditLog"]] = relationship(back_populates="organization")
    subscription: Mapped[Optional["Subscription"]] = relationship(back_populates="organization", uselist=False)


class User(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(50))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_superadmin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    fcm_token: Mapped[Optional[str]] = mapped_column(String(500))

    # Relationships
    memberships: Mapped[List["OrganizationMember"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    refresh_tokens: Mapped[List["RefreshToken"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class OrganizationMember(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "organization_members"

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[UserRoleEnum] = mapped_column(
        SAEnum(UserRoleEnum, name="user_role_enum"), nullable=False
    )
    property_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("properties.id", ondelete="SET NULL"), nullable=True, index=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    organization: Mapped["Organization"] = relationship(back_populates="members")
    user: Mapped["User"] = relationship(back_populates="memberships")
    property: Mapped[Optional["Property"]] = relationship(foreign_keys=[property_id])

    __table_args__ = (
        UniqueConstraint("organization_id", "user_id", name="uq_org_member"),
    )


class RefreshToken(Base, UUIDMixin):
    __tablename__ = "refresh_tokens"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token_hash: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.utcnow(), nullable=False
    )
    ip_address: Mapped[Optional[str]] = mapped_column(String(50))
    user_agent: Mapped[Optional[str]] = mapped_column(String(500))

    # Relationships
    user: Mapped["User"] = relationship(back_populates="refresh_tokens")


# =============================================================================
# RBAC — Roles & Permissions
# =============================================================================

class Role(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "roles"

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    is_system_role: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    permissions: Mapped[List["RolePermission"]] = relationship(back_populates="role", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("organization_id", "name", name="uq_role_org_name"),
    )


class Permission(Base, UUIDMixin):
    __tablename__ = "permissions"

    code: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    description: Mapped[str] = mapped_column(String(300), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)


class RolePermission(Base, UUIDMixin):
    __tablename__ = "role_permissions"

    role_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("roles.id", ondelete="CASCADE"), nullable=False
    )
    permission_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("permissions.id", ondelete="CASCADE"), nullable=False
    )

    role: Mapped["Role"] = relationship(back_populates="permissions")
    permission: Mapped["Permission"] = relationship()

    __table_args__ = (
        UniqueConstraint("role_id", "permission_id", name="uq_role_permission"),
    )


# =============================================================================
# Properties & Rooms
# =============================================================================

class Property(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "properties"

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    address: Mapped[str] = mapped_column(Text, nullable=False)
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    country: Mapped[str] = mapped_column(String(100), nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(50))
    email: Mapped[Optional[str]] = mapped_column(String(255))
    timezone: Mapped[str] = mapped_column(String(100), default="UTC", nullable=False)
    check_in_time: Mapped[str] = mapped_column(String(5), default="14:00", nullable=False)
    check_out_time: Mapped[str] = mapped_column(String(5), default="11:00", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    organization: Mapped["Organization"] = relationship(back_populates="properties")
    rooms: Mapped[List["Room"]] = relationship(back_populates="property")
    room_types: Mapped[List["RoomType"]] = relationship(back_populates="property")
    services: Mapped[List["Service"]] = relationship(back_populates="property")
    housekeeping_tasks: Mapped[List["HousekeepingTask"]] = relationship(back_populates="property")


class RoomType(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "room_types"

    property_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("properties.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    is_ac: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    max_guests: Mapped[int] = mapped_column(Integer, default=2, nullable=False)

    # Rates (stored in smallest currency unit, e.g., cents or as decimal)
    base_hourly_rate: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    base_day_use_rate: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    base_nightly_rate: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    base_daily_rate: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    extra_hour_rate: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    extra_guest_rate: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0, nullable=False)

    # Relationships
    property: Mapped["Property"] = relationship(back_populates="room_types")
    rooms: Mapped[List["Room"]] = relationship(back_populates="room_type")
    amenities: Mapped[List["RoomAmenity"]] = relationship(back_populates="room_type", cascade="all, delete-orphan")
    rate_plans: Mapped[List["RatePlan"]] = relationship(back_populates="room_type")


class Amenity(Base, UUIDMixin):
    __tablename__ = "amenities"

    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    icon: Mapped[Optional[str]] = mapped_column(String(100))


class RoomAmenity(Base, UUIDMixin):
    __tablename__ = "room_amenities"

    room_type_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("room_types.id", ondelete="CASCADE"), nullable=False
    )
    amenity_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("amenities.id", ondelete="CASCADE"), nullable=False
    )

    room_type: Mapped["RoomType"] = relationship(back_populates="amenities")
    amenity: Mapped["Amenity"] = relationship()

    __table_args__ = (
        UniqueConstraint("room_type_id", "amenity_id", name="uq_room_amenity"),
    )


class Room(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "rooms"

    property_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("properties.id", ondelete="CASCADE"), nullable=False, index=True
    )
    room_type_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("room_types.id"), nullable=False, index=True
    )
    room_number: Mapped[str] = mapped_column(String(20), nullable=False)
    floor: Mapped[Optional[str]] = mapped_column(String(10))
    max_guests: Mapped[int] = mapped_column(Integer, default=2, nullable=False)
    status: Mapped[RoomStatusEnum] = mapped_column(
        SAEnum(RoomStatusEnum, name="room_status_enum"),
        default=RoomStatusEnum.AVAILABLE,
        nullable=False,
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text)

    # Relationships
    property: Mapped["Property"] = relationship(back_populates="rooms")
    room_type: Mapped["RoomType"] = relationship(back_populates="rooms")
    reservations: Mapped[List["Reservation"]] = relationship(back_populates="room")
    stays: Mapped[List["Stay"]] = relationship(back_populates="room")
    status_history: Mapped[List["RoomStatusHistory"]] = relationship(back_populates="room")
    housekeeping_tasks: Mapped[List["HousekeepingTask"]] = relationship(back_populates="room")

    __table_args__ = (
        UniqueConstraint("property_id", "room_number", name="uq_room_property_number"),
    )


class RoomStatusHistory(Base, UUIDMixin):
    __tablename__ = "room_status_history"

    room_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False, index=True
    )
    from_status: Mapped[Optional[RoomStatusEnum]] = mapped_column(SAEnum(RoomStatusEnum, name="room_status_enum"))
    to_status: Mapped[RoomStatusEnum] = mapped_column(SAEnum(RoomStatusEnum, name="room_status_enum"), nullable=False)
    changed_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.utcnow(), nullable=False
    )

    room: Mapped["Room"] = relationship(back_populates="status_history")


# =============================================================================
# Guests & Identity
# =============================================================================

class Guest(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "guests"

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    full_name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), index=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), index=True)
    date_of_birth: Mapped[Optional[date]] = mapped_column(Date)
    address: Mapped[Optional[str]] = mapped_column(Text)
    preferred_language: Mapped[Optional[str]] = mapped_column(String(10))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    blacklisted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    organization: Mapped["Organization"] = relationship(back_populates="guests")
    documents: Mapped[List["GuestDocument"]] = relationship(back_populates="guest", cascade="all, delete-orphan")
    verifications: Mapped[List["GuestVerification"]] = relationship(back_populates="guest")
    reservations: Mapped[List["Reservation"]] = relationship(back_populates="primary_guest")
    stays: Mapped[List["Stay"]] = relationship(back_populates="primary_guest")


class GuestDocument(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "guest_documents"

    guest_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("guests.id", ondelete="CASCADE"), nullable=False, index=True
    )
    document_type: Mapped[DocumentTypeEnum] = mapped_column(
        SAEnum(DocumentTypeEnum, name="document_type_enum"), nullable=False
    )
    document_number: Mapped[Optional[str]] = mapped_column(String(100))
    full_name: Mapped[Optional[str]] = mapped_column(String(200))
    date_of_birth: Mapped[Optional[date]] = mapped_column(Date)
    address: Mapped[Optional[str]] = mapped_column(Text)

    # Storage (S3 key — never expose directly)
    file_key: Mapped[str] = mapped_column(String(500), nullable=False)
    file_size: Mapped[Optional[int]] = mapped_column(Integer)
    content_type: Mapped[Optional[str]] = mapped_column(String(100))

    # OCR
    ocr_raw: Mapped[Optional[dict]] = mapped_column(JSONB)
    ocr_confidence: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 4))

    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    guest: Mapped["Guest"] = relationship(back_populates="documents")
    verifications: Mapped[List["GuestVerification"]] = relationship(back_populates="document")


class GuestVerification(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "guest_verifications"

    guest_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("guests.id", ondelete="CASCADE"), nullable=False, index=True
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("guest_documents.id"), nullable=False
    )
    status: Mapped[VerificationStatusEnum] = mapped_column(
        SAEnum(VerificationStatusEnum, name="verification_status_enum"),
        default=VerificationStatusEnum.PENDING,
        nullable=False,
    )
    verified_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    notes: Mapped[Optional[str]] = mapped_column(Text)

    guest: Mapped["Guest"] = relationship(back_populates="verifications")
    document: Mapped["GuestDocument"] = relationship(back_populates="verifications")


# =============================================================================
# Reservations
# =============================================================================

class Reservation(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "reservations"

    reservation_number: Mapped[str] = mapped_column(String(20), nullable=False, unique=True, index=True)
    property_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("properties.id"), nullable=False, index=True
    )
    room_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("rooms.id"), nullable=False, index=True
    )
    primary_guest_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("guests.id"), nullable=False, index=True
    )
    stay_type: Mapped[StayTypeEnum] = mapped_column(
        SAEnum(StayTypeEnum, name="stay_type_enum"), nullable=False
    )

    check_in_date: Mapped[date] = mapped_column(Date, nullable=False)
    check_in_time: Mapped[Optional[str]] = mapped_column(String(5))
    expected_checkout_date: Mapped[date] = mapped_column(Date, nullable=False)
    expected_checkout_time: Mapped[Optional[str]] = mapped_column(String(5))

    num_guests: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    booking_source: Mapped[BookingSourceEnum] = mapped_column(
        SAEnum(BookingSourceEnum, name="booking_source_enum"),
        default=BookingSourceEnum.WALK_IN,
        nullable=False,
    )
    status: Mapped[ReservationStatusEnum] = mapped_column(
        SAEnum(ReservationStatusEnum, name="reservation_status_enum"),
        default=ReservationStatusEnum.PENDING,
        nullable=False,
        index=True,
    )
    special_requests: Mapped[Optional[str]] = mapped_column(Text)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    advance_payment: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    cancellation_reason: Mapped[Optional[str]] = mapped_column(Text)
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    # Relationships
    property: Mapped["Property"] = relationship()
    room: Mapped["Room"] = relationship(back_populates="reservations")
    primary_guest: Mapped["Guest"] = relationship(back_populates="reservations")
    stay: Mapped[Optional["Stay"]] = relationship(back_populates="reservation")

    __table_args__ = (
        Index("ix_reservations_dates", "room_id", "check_in_date", "expected_checkout_date"),
    )


# =============================================================================
# Stays
# =============================================================================

class Stay(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "stays"

    reservation_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("reservations.id"), nullable=True, unique=True
    )
    property_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("properties.id"), nullable=False, index=True
    )
    room_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("rooms.id"), nullable=False, index=True
    )
    primary_guest_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("guests.id"), nullable=False, index=True
    )
    stay_type: Mapped[StayTypeEnum] = mapped_column(
        SAEnum(StayTypeEnum, name="stay_type_enum"), nullable=False
    )

    actual_check_in: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expected_checkout: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    actual_checkout: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    num_guests: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    checked_in_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    checked_out_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    notes: Mapped[Optional[str]] = mapped_column(Text)

    # Relationships
    reservation: Mapped[Optional["Reservation"]] = relationship(back_populates="stay")
    room: Mapped["Room"] = relationship(back_populates="stays")
    primary_guest: Mapped["Guest"] = relationship(back_populates="stays")
    folio: Mapped[Optional["Folio"]] = relationship(back_populates="stay", uselist=False)
    service_orders: Mapped[List["ServiceOrder"]] = relationship(back_populates="stay")
    housekeeping_tasks: Mapped[List["HousekeepingTask"]] = relationship(back_populates="stay")


# =============================================================================
# Pricing
# =============================================================================

class RatePlan(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "rate_plans"

    room_type_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("room_types.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    room_type: Mapped["RoomType"] = relationship(back_populates="rate_plans")
    rates: Mapped[List["RoomRate"]] = relationship(back_populates="rate_plan", cascade="all, delete-orphan")
    rules: Mapped[List["RateRule"]] = relationship(back_populates="rate_plan", cascade="all, delete-orphan")


class RoomRate(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "room_rates"

    rate_plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("rate_plans.id", ondelete="CASCADE"), nullable=False
    )
    stay_type: Mapped[StayTypeEnum] = mapped_column(SAEnum(StayTypeEnum, name="stay_type_enum"), nullable=False)
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    effective_to: Mapped[Optional[date]] = mapped_column(Date)
    rate: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)

    rate_plan: Mapped["RatePlan"] = relationship(back_populates="rates")


class RateRule(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "rate_rules"

    rate_plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("rate_plans.id", ondelete="CASCADE"), nullable=False
    )
    rule_type: Mapped[str] = mapped_column(String(50), nullable=False)  # weekend, holiday, seasonal
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    adjustment_type: Mapped[str] = mapped_column(String(20), nullable=False)  # percent, fixed
    adjustment_value: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    conditions: Mapped[Optional[dict]] = mapped_column(JSONB)

    rate_plan: Mapped["RatePlan"] = relationship(back_populates="rules")


# =============================================================================
# Billing — Folio & Invoice
# =============================================================================

class Folio(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "folios"

    stay_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stays.id"), nullable=False, unique=True, index=True
    )
    is_finalized: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    finalized_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    stay: Mapped["Stay"] = relationship(back_populates="folio")
    items: Mapped[List["FolioItem"]] = relationship(back_populates="folio", cascade="all, delete-orphan")
    invoice: Mapped[Optional["Invoice"]] = relationship(back_populates="folio", uselist=False)


class FolioItem(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "folio_items"

    folio_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("folios.id", ondelete="CASCADE"), nullable=False, index=True
    )
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(10, 3), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    total: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text)

    folio: Mapped["Folio"] = relationship(back_populates="items")


class Invoice(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "invoices"

    invoice_number: Mapped[str] = mapped_column(String(30), nullable=False, unique=True, index=True)
    folio_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("folios.id"), nullable=False, unique=True
    )
    stay_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stays.id"), nullable=False, index=True
    )
    guest_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("guests.id"), nullable=False
    )

    # Snapshot totals (immutable after finalization)
    room_charge: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    services_total: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    discount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    tax: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    grand_total: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)

    is_finalized: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    finalized_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    notes: Mapped[Optional[str]] = mapped_column(Text)

    folio: Mapped["Folio"] = relationship(back_populates="invoice")
    items: Mapped[List["InvoiceItem"]] = relationship(back_populates="invoice", cascade="all, delete-orphan")
    payments: Mapped[List["Payment"]] = relationship(back_populates="invoice")


class InvoiceItem(Base, UUIDMixin):
    __tablename__ = "invoice_items"

    invoice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True
    )
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(10, 3), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)  # price at time of invoice
    total: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)

    invoice: Mapped["Invoice"] = relationship(back_populates="items")


# =============================================================================
# Payments
# =============================================================================

class Payment(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "payments"

    invoice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=False, index=True
    )
    payment_method: Mapped[PaymentMethodEnum] = mapped_column(
        SAEnum(PaymentMethodEnum, name="payment_method_enum"), nullable=False
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    reference: Mapped[Optional[str]] = mapped_column(String(200))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    invoice: Mapped["Invoice"] = relationship(back_populates="payments")
    refunds: Mapped[List["Refund"]] = relationship(back_populates="payment", cascade="all, delete-orphan")


class Refund(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "refunds"

    payment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("payments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    payment: Mapped["Payment"] = relationship(back_populates="refunds")


# =============================================================================
# Services
# =============================================================================

class Service(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "services"

    property_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("properties.id", ondelete="CASCADE"), nullable=False, index=True
    )
    category: Mapped[ServiceCategoryEnum] = mapped_column(
        SAEnum(ServiceCategoryEnum, name="service_category_enum"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    property: Mapped["Property"] = relationship(back_populates="services")
    orders: Mapped[List["ServiceOrder"]] = relationship(back_populates="service")


class ServiceOrder(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "service_orders"

    stay_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stays.id"), nullable=False, index=True
    )
    folio_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("folios.id"), nullable=False
    )
    service_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("services.id"), nullable=False
    )
    quantity: Mapped[Decimal] = mapped_column(Numeric(10, 3), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    total: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    stay: Mapped["Stay"] = relationship(back_populates="service_orders")
    service: Mapped["Service"] = relationship(back_populates="orders")


# =============================================================================
# Housekeeping
# =============================================================================

class HousekeepingTask(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "housekeeping_tasks"

    property_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("properties.id"), nullable=False, index=True
    )
    room_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("rooms.id"), nullable=False, index=True
    )
    stay_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stays.id"), nullable=True
    )
    assigned_to: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    status: Mapped[HousekeepingStatusEnum] = mapped_column(
        SAEnum(HousekeepingStatusEnum, name="housekeeping_status_enum"),
        default=HousekeepingStatusEnum.PENDING,
        nullable=False,
        index=True,
    )
    priority: Mapped[HousekeepingPriorityEnum] = mapped_column(
        SAEnum(HousekeepingPriorityEnum, name="housekeeping_priority_enum"),
        default=HousekeepingPriorityEnum.NORMAL,
        nullable=False,
    )
    notes: Mapped[Optional[str]] = mapped_column(Text)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    property: Mapped["Property"] = relationship(back_populates="housekeeping_tasks")
    room: Mapped["Room"] = relationship(back_populates="housekeeping_tasks")
    stay: Mapped[Optional["Stay"]] = relationship(back_populates="housekeeping_tasks")


# =============================================================================
# Notifications
# =============================================================================

class Notification(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "notifications"

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True
    )
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True
    )
    event: Mapped[NotificationEventEnum] = mapped_column(
        SAEnum(NotificationEventEnum, name="notification_event_enum"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    data: Mapped[Optional[dict]] = mapped_column(JSONB)
    is_sent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))


# =============================================================================
# Audit Log
# =============================================================================

class AuditLog(Base, UUIDMixin):
    __tablename__ = "audit_logs"

    organization_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True, index=True
    )
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True
    )
    action: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    entity_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    entity_id: Mapped[Optional[str]] = mapped_column(String(100))
    old_values: Mapped[Optional[dict]] = mapped_column(JSONB)
    new_values: Mapped[Optional[dict]] = mapped_column(JSONB)
    ip_address: Mapped[Optional[str]] = mapped_column(String(50))
    user_agent: Mapped[Optional[str]] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.utcnow(), nullable=False, index=True
    )

    organization: Mapped[Optional["Organization"]] = relationship(back_populates="audit_logs")


# =============================================================================
# Subscriptions
# =============================================================================

class SubscriptionPlan(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "subscription_plans"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    price_monthly: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    price_yearly: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    max_properties: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    max_rooms: Mapped[int] = mapped_column(Integer, default=20, nullable=False)
    max_users: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    features: Mapped[Optional[dict]] = mapped_column(JSONB)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class Subscription(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "subscriptions"

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, unique=True
    )
    plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subscription_plans.id"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(50), default="active", nullable=False)
    current_period_start: Mapped[date] = mapped_column(Date, nullable=False)
    current_period_end: Mapped[date] = mapped_column(Date, nullable=False)
    trial_ends_at: Mapped[Optional[date]] = mapped_column(Date)
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    organization: Mapped["Organization"] = relationship(back_populates="subscription")
    plan: Mapped["SubscriptionPlan"] = relationship()
