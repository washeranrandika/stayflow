"""
Custom exception classes for domain-specific errors.
"""
from fastapi import HTTPException, status


class StayFlowException(HTTPException):
    """Base exception for StayFlow domain errors."""
    def __init__(self, code: str, message: str, status_code: int = status.HTTP_400_BAD_REQUEST):
        super().__init__(
            status_code=status_code,
            detail={"code": code, "message": message},
        )


class RoomNotAvailableError(StayFlowException):
    def __init__(self, room_number: str = ""):
        super().__init__(
            code="ROOM_NOT_AVAILABLE",
            message=f"Room {room_number} is not available for the requested dates.",
        )


class BookingOverlapError(StayFlowException):
    def __init__(self):
        super().__init__(
            code="BOOKING_OVERLAP",
            message="The selected room already has an overlapping reservation.",
        )


class ReservationNotFoundError(StayFlowException):
    def __init__(self):
        super().__init__(
            code="RESERVATION_NOT_FOUND",
            message="Reservation not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )


class StayNotFoundError(StayFlowException):
    def __init__(self):
        super().__init__(
            code="STAY_NOT_FOUND",
            message="Stay not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )


class InvoiceFinalizedError(StayFlowException):
    def __init__(self):
        super().__init__(
            code="INVOICE_FINALIZED",
            message="Cannot modify a finalized invoice.",
        )


class InsufficientPaymentError(StayFlowException):
    def __init__(self, balance: float):
        super().__init__(
            code="INSUFFICIENT_PAYMENT",
            message=f"Outstanding balance of {balance:.2f} must be settled before checkout.",
        )


class TenantViolationError(StayFlowException):
    def __init__(self):
        super().__init__(
            code="TENANT_VIOLATION",
            message="Access denied: resource does not belong to your organization.",
            status_code=status.HTTP_403_FORBIDDEN,
        )


class GuestDocumentAccessDenied(StayFlowException):
    def __init__(self):
        super().__init__(
            code="DOCUMENT_ACCESS_DENIED",
            message="You do not have permission to access this document.",
            status_code=status.HTTP_403_FORBIDDEN,
        )
