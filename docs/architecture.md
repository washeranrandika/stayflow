# StayFlow Architecture

## 1. Overview
StayFlow is a production-ready, mobile-first, multi-tenant Property Management System (PMS) built specifically for guest houses, small boutique hotels, villas, and accommodation businesses.

The application is structured as a **modular monolith** with clear separation of business domains, stateless REST APIs, transactional database guarantees, and server-side authorization enforcement.

```
                              ┌─────────────────────────────────────────┐
                              │           StayFlow Monorepo             │
                              └────────────────────┬────────────────────┘
                                                   │
        ┌──────────────────────────────────────────┼──────────────────────────────────────────┐
        │                                          │                                          │
 ┌──────▼──────┐                            ┌──────▼──────┐                            ┌──────▼──────┐
 │ apps/mobile │ (React Native / Expo)      │ apps/admin  │ (Next.js 14 App Router)    │  apps/api   │ (FastAPI Modular Monolith)
 └─────────────┘                            └─────────────┘                            └──────┬──────┘
        │                                          │                                          │
        └──────────────────────────────────────────┴──────────────────────────────────────────┘
                                                   │
                                            ┌──────▼──────┐
                                            │ PostgreSQL  │ (Multi-tenant schema + ACID)
                                            └──────┬──────┘
                                                   │
                                      ┌────────────┴────────────┐
                                      │ Redis / Celery Workers  │ (Background jobs & reminders)
                                      └─────────────────────────┘
```

---

## 2. Multi-Tenancy Architecture
StayFlow is designed from day one as a Software-as-a-Service (SaaS) multi-tenant platform.

### Tenant Hierarchy
```
Organization (Tenant Root)
    └── Properties (e.g., Colombo Guest House, Kandy Guest House)
            └── Room Types & Rooms
                    └── Reservations & Stays
```

### Isolation Guarantees
1. **Never trust client-supplied `organization_id`**: The tenant identity is always derived from the authenticated user's verified JWT token and membership record.
2. **Backend Query Filtering**: Every database query joins through `Property.organization_id` or verifies `organization_id == current_user.organization_id`.
3. **Multi-Property Organizations**: An organization can have multiple properties. Staff members can be restricted to specific properties while Owners/Managers have organization-wide visibility.

---

## 3. Role-Based Access Control (RBAC)
StayFlow implements granular permissions enforced via FastAPI dependency injection:

| Role | Description | Key Permissions |
|---|---|---|
| **OWNER** | Full account owner | All administrative, operational, billing, audit, and organizational permissions |
| **MANAGER** | Property operations manager | Operational management, staff oversight, pricing adjustments, reporting |
| **RECEPTIONIST** | Front-desk operator | Room views, booking creation, walk-in check-in, checkout, folios, payments |
| **HOUSEKEEPER** | Cleaning & maintenance | Room status inspection, task completion marking room AVAILABLE |

### Permission Check Implementation
```python
# Route-level declarative enforcement
@router.post("/check-in")
async def check_in(
    current_user: CurrentUser = Depends(require_permission(Permission.STAY_CHECKIN)),
):
    ...
```

---

## 4. Operational Workflows & Concurrency Safety

### Transactional Room Assignment
To prevent two receptionists from assigning the same room to overlapping stays, StayFlow executes database row-level locking:
```python
# Pessimistic locking prevents race conditions on check-in
select(Room).where(Room.id == room_id).with_for_update()
```
Room availability calculations are strictly executed server-side via SQL range intersection tests.

### Stay vs Reservation Separation
A `Reservation` is a future intent to stay. A `Stay` is an active physical occupancy.
```
Reservation (PENDING/CONFIRMED)
     ↓ [Check-In Action]
Stay (ACTIVE, Room: OCCUPIED)
     ↓ [Check-Out Action]
Stay (COMPLETED, Room: CLEANING, Housekeeping Task Created)
     ↓ [Housekeeping Completed]
Room (AVAILABLE)
```

---

## 5. Sensitive Identity & Document Security
Guest identity documents (National ID, Passport, Driving License) are classified as sensitive PII:
1. **Private Object Storage**: Files are stored in private S3/MinIO buckets. No document is ever served via public URLs.
2. **Short-lived Pre-Signed URLs**: Staff with `guest.document.view` permission receive temporary signed URLs (5-minute expiry).
3. **Assistive OCR**: OCR assists data extraction for speed, but is explicitly separated from verification. Staff must manually confirm extracted fields.
4. **Audit Trail**: Every document upload, viewing, and deletion is recorded in `audit_logs`.

---

## 6. Background Processing & Notifications
- **Celery + Redis**: Asynchronous job queue handling scheduled checkout alerts (15 minutes before checkout, checkout time reached, overdue checkout).
- **Notification Abstraction**: Modular notification service supporting development console logging, Firebase Cloud Messaging (FCM) for mobile push, and future official WhatsApp Business API integrations.
