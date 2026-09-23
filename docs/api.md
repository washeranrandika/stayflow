# StayFlow API Specification (/api/v1)

All StayFlow REST endpoints are served under `/api/v1` with consistent JSON envelopes and HTTP status codes.

---

## 1. Response Standards

### Success Envelope
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully",
  "meta": null
}
```

### Paginated Envelope
```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "page": 1,
    "page_size": 20,
    "total": 45,
    "total_pages": 3
  }
}
```

### Error Envelope
```json
{
  "success": false,
  "error": {
    "code": "ROOM_NOT_AVAILABLE",
    "message": "Room 101 is currently occupied."
  }
}
```

---

## 2. API Endpoints

### 2.1 Authentication
- **`POST /api/v1/auth/login`**: Authenticate staff and return JWT tokens.
  - Body: `{"email": "...", "password": "..."}`
  - Returns: `tokens` (`access_token`, `refresh_token`, `expires_in`), `user` profile.
- **`POST /api/v1/auth/refresh`**: Rotate refresh token and get a fresh access token.
  - Body: `{"refresh_token": "..."}`
- **`POST /api/v1/auth/logout`**: Revoke refresh token.
- **`GET /api/v1/users/me`**: Return authenticated user profile and organization membership.

### 2.2 Properties
- **`GET /api/v1/properties`**: List properties belonging to user's organization.
- **`POST /api/v1/properties`**: Create a new property under organization.
- **`GET /api/v1/properties/{id}`**: Get single property details.
- **`PATCH /api/v1/properties/{id}`**: Update property info.

### 2.3 Rooms & Room Types
- **`GET /api/v1/rooms/by-property/{property_id}`**: List rooms for property (optional filter: `status`).
- **`POST /api/v1/rooms`**: Create room.
- **`GET /api/v1/rooms/{id}`**: Room details with room type and current status.
- **`PATCH /api/v1/rooms/{id}/status`**: Update room status (`AVAILABLE`, `CLEANING`, `MAINTENANCE`, `OUT_OF_SERVICE`).
- **`GET /api/v1/room-types/by-property/{property_id}`**: List room types and pricing tiers.
- **`POST /api/v1/room-types`**: Create room type with hourly/day-use/nightly/daily rates.

### 2.4 Reservations / Bookings
- **`GET /api/v1/bookings`**: List reservations (filters: `property_id`, `status`, `date_from`, `date_to`).
- **`POST /api/v1/bookings`**: Create reservation (checks server-side room availability).
- **`GET /api/v1/bookings/{id}`**: Reservation details.
- **`POST /api/v1/bookings/{id}/cancel`**: Cancel reservation with reason.

### 2.5 Guests & Identity
- **`GET /api/v1/guests`**: List and search guests by name, phone, or email.
- **`POST /api/v1/guests`**: Create guest profile.
- **`GET /api/v1/guests/{id}`**: Guest profile with verification status.
- **`GET /api/v1/guests/{id}/history`**: Guest history of past reservations and stays.
- **`POST /api/v1/identity/documents`**: Multipart upload of ID document (stores in private storage, initiates OCR extraction).
- **`GET /api/v1/identity/documents/{id}/url`**: Generate 5-minute signed URL to view document (audit logged).
- **`POST /api/v1/identity/verifications`**: Confirm or reject extracted identity details.

### 2.6 Stays & Check-In
- **`POST /api/v1/stays/check-in`**: Execute walk-in or reservation check-in.
  - Body: `{"property_id": "...", "room_id": "...", "primary_guest_id": "...", "stay_type": "HOURLY"|"DAY_USE"|"OVERNIGHT"|"DAILY", "expected_checkout": "..."}`
  - Atomic action: Locks room, verifies availability, creates `Stay`, creates `Folio`, sets room to `OCCUPIED`, schedules automated checkout alerts.
- **`GET /api/v1/stays/{id}`**: Get active stay details.
- **`GET /api/v1/stays/{id}/pricing`**: Real-time server-side pricing calculation with overtime breakdown.
- **`POST /api/v1/stays/{id}/checkout`**: Complete checkout.
  - Atomic action: Calculates final bill, finalizes invoice snapshot, sets room to `CLEANING`, creates `HousekeepingTask`, completes stay.

### 2.7 Folios & Billing
- **`GET /api/v1/billing/folios/{folio_id}`**: Get running folio items and total.
- **`POST /api/v1/billing/folios/{folio_id}/items`**: Add item (food, minibar, laundry, extra service).
- **`GET /api/v1/billing/invoices/{invoice_id}`**: Retrieve finalized invoice with payment history and outstanding balance.

### 2.8 Payments
- **`POST /api/v1/payments/invoices/{invoice_id}/payments`**: Record payment (`CASH`, `CARD`, `BANK_TRANSFER`, `QR`).
  - Supports partial payments and deposits.
- **`GET /api/v1/payments/invoices/{invoice_id}/payments`**: List payments for invoice.
- **`POST /api/v1/payments/{payment_id}/refund`**: Process partial or full payment refund with reason.

### 2.9 Housekeeping
- **`GET /api/v1/housekeeping/tasks`**: List cleaning tasks (filters: `property_id`, `status`, `assigned_to`).
- **`PATCH /api/v1/housekeeping/tasks/{id}`**: Update task (`PENDING` -> `IN_PROGRESS` -> `COMPLETED`).
  - Marking `COMPLETED` automatically transitions the room from `CLEANING` to `AVAILABLE`.

### 2.10 Reports & Analytics
- **`GET /api/v1/reports/revenue`**: Daily/monthly revenue breakdown with date filtering.
- **`GET /api/v1/reports/occupancy`**: Room occupancy percentage across properties.
- **`GET /api/v1/reports/payments`**: Payments grouped by payment method.
- **`GET /api/v1/reports/dashboard`**: Consolidated KPI dashboard summary.

### 2.11 Audit & Subscriptions
- **`GET /api/v1/audit`**: Query immutable audit log trail with actor, action, and before/after values.
- **`GET /api/v1/subscriptions/current`**: Get tenant subscription tier, limits, and active status.
