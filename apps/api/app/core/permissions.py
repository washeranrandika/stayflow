"""
RBAC — Permission definitions and role assignments.
All permissions are defined here as constants to avoid magic strings.
"""
from enum import Enum


class Permission(str, Enum):
    # Property
    PROPERTY_VIEW = "property.view"
    PROPERTY_CREATE = "property.create"
    PROPERTY_UPDATE = "property.update"
    PROPERTY_DELETE = "property.delete"

    # Room
    ROOM_VIEW = "room.view"
    ROOM_CREATE = "room.create"
    ROOM_UPDATE = "room.update"
    ROOM_DELETE = "room.delete"
    ROOM_STATUS_UPDATE = "room.status.update"

    # Room Type
    ROOM_TYPE_VIEW = "room_type.view"
    ROOM_TYPE_CREATE = "room_type.create"
    ROOM_TYPE_UPDATE = "room_type.update"
    ROOM_TYPE_DELETE = "room_type.delete"

    # Booking
    BOOKING_VIEW = "booking.view"
    BOOKING_CREATE = "booking.create"
    BOOKING_UPDATE = "booking.update"
    BOOKING_CANCEL = "booking.cancel"

    # Guest
    GUEST_VIEW = "guest.view"
    GUEST_CREATE = "guest.create"
    GUEST_UPDATE = "guest.update"
    GUEST_DOCUMENT_VIEW = "guest.document.view"
    GUEST_DOCUMENT_DELETE = "guest.document.delete"

    # Stay
    STAY_CHECKIN = "stay.checkin"
    STAY_CHECKOUT = "stay.checkout"
    STAY_VIEW = "stay.view"

    # Invoice
    INVOICE_VIEW = "invoice.view"
    INVOICE_CREATE = "invoice.create"
    INVOICE_FINALIZE = "invoice.finalize"

    # Payment
    PAYMENT_VIEW = "payment.view"
    PAYMENT_CREATE = "payment.create"
    PAYMENT_REFUND = "payment.refund"

    # Report
    REPORT_VIEW = "report.view"

    # Staff
    STAFF_MANAGE = "staff.manage"

    # Audit
    AUDIT_VIEW = "audit.view"

    # Housekeeping
    HOUSEKEEPING_VIEW = "housekeeping.view"
    HOUSEKEEPING_UPDATE = "housekeeping.update"

    # Services
    SERVICE_VIEW = "service.view"
    SERVICE_CREATE = "service.create"
    SERVICE_UPDATE = "service.update"

    # Pricing
    PRICING_VIEW = "pricing.view"
    PRICING_UPDATE = "pricing.update"

    # Organization
    ORG_SETTINGS = "org.settings"


# Default role→permissions mapping
# This is used when seeding roles. Custom roles can be created per org.
ROLE_PERMISSIONS: dict[str, list[str]] = {
    "OWNER": [p.value for p in Permission],  # All permissions

    "MANAGER": [
        Permission.PROPERTY_VIEW,
        Permission.PROPERTY_UPDATE,
        Permission.ROOM_VIEW,
        Permission.ROOM_CREATE,
        Permission.ROOM_UPDATE,
        Permission.ROOM_STATUS_UPDATE,
        Permission.ROOM_TYPE_VIEW,
        Permission.ROOM_TYPE_CREATE,
        Permission.ROOM_TYPE_UPDATE,
        Permission.BOOKING_VIEW,
        Permission.BOOKING_CREATE,
        Permission.BOOKING_UPDATE,
        Permission.BOOKING_CANCEL,
        Permission.GUEST_VIEW,
        Permission.GUEST_CREATE,
        Permission.GUEST_UPDATE,
        Permission.GUEST_DOCUMENT_VIEW,
        Permission.STAY_CHECKIN,
        Permission.STAY_CHECKOUT,
        Permission.STAY_VIEW,
        Permission.INVOICE_VIEW,
        Permission.INVOICE_CREATE,
        Permission.INVOICE_FINALIZE,
        Permission.PAYMENT_VIEW,
        Permission.PAYMENT_CREATE,
        Permission.PAYMENT_REFUND,
        Permission.REPORT_VIEW,
        Permission.STAFF_MANAGE,
        Permission.HOUSEKEEPING_VIEW,
        Permission.HOUSEKEEPING_UPDATE,
        Permission.SERVICE_VIEW,
        Permission.SERVICE_CREATE,
        Permission.SERVICE_UPDATE,
        Permission.PRICING_VIEW,
        Permission.PRICING_UPDATE,
        Permission.AUDIT_VIEW,
    ],

    "RECEPTIONIST": [
        Permission.ROOM_VIEW,
        Permission.ROOM_STATUS_UPDATE,
        Permission.ROOM_TYPE_VIEW,
        Permission.BOOKING_VIEW,
        Permission.BOOKING_CREATE,
        Permission.BOOKING_UPDATE,
        Permission.BOOKING_CANCEL,
        Permission.GUEST_VIEW,
        Permission.GUEST_CREATE,
        Permission.GUEST_UPDATE,
        Permission.GUEST_DOCUMENT_VIEW,
        Permission.STAY_CHECKIN,
        Permission.STAY_CHECKOUT,
        Permission.STAY_VIEW,
        Permission.INVOICE_VIEW,
        Permission.INVOICE_CREATE,
        Permission.PAYMENT_VIEW,
        Permission.PAYMENT_CREATE,
        Permission.HOUSEKEEPING_VIEW,
        Permission.SERVICE_VIEW,
        Permission.SERVICE_CREATE,
        Permission.PRICING_VIEW,
    ],

    "HOUSEKEEPER": [
        Permission.ROOM_VIEW,
        Permission.ROOM_STATUS_UPDATE,
        Permission.HOUSEKEEPING_VIEW,
        Permission.HOUSEKEEPING_UPDATE,
    ],
}
