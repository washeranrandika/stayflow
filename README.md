# StayFlow — Production PMS Monorepo

StayFlow is a mobile-first, multi-tenant Property Management System (PMS) designed for guest houses, small boutique hotels, villas, and accommodation businesses.

---

## 1. Monorepo Structure

```
StayFlow/
├── apps/
│   ├── mobile/         # React Native (Expo SDK 51, TypeScript, Zustand, TanStack Query)
│   ├── admin/          # Next.js 14 App Router, TypeScript, Tailwind CSS, Lucide
│   └── api/            # FastAPI, Python 3.11, SQLAlchemy 2.0, PostgreSQL, Alembic, Celery
│
├── packages/
│   ├── types/          # Shared TypeScript type definitions
│   ├── validation/     # Shared Zod validation schemas
│   └── config/         # Shared status tokens, configs & business defaults
│
├── docs/
│   ├── architecture.md    # Multi-tenancy, RBAC, background jobs & security
│   ├── database.md        # Relational schema, tables & entity relationships
│   ├── api.md             # REST API specifications under /api/v1
│   └── business-rules.md  # Room availability, pricing engine & billing rules
│
├── docker-compose.yml  # PostgreSQL & Redis infrastructure
├── .env.example        # Reference environment variables
└── README.md
```

---

## 2. Tech Stack

- **Backend**: Python 3.11, FastAPI, SQLAlchemy 2.0 (asyncio + asyncpg), Alembic, Pydantic v2, Celery, Redis, PostgreSQL.
- **Admin Web Panel**: Next.js 14 (App Router), TypeScript, Tailwind CSS, TanStack React Query, React Hook Form, Lucide React.
- **Mobile Application**: React Native, Expo, TypeScript, Expo Router, NativeWind/Tailwind, Zustand, Lucide React Native.
- **Authentication**: JWT access tokens + rotating refresh tokens + Role-Based Access Control (RBAC).
- **Storage**: S3-compatible private object storage with time-limited signed URLs for guest ID documents.

---

## 3. Demo Credentials (Local Development)

The database is seeded with a demo organization: **"StayFlow Demo Hospitality"** and property **"Colombo Guest House"**.

| Role | Email | Password |
|---|---|---|
| **Owner** | `owner@stayflow.demo` | `Demo@12345!` |
| **Manager** | `manager@stayflow.demo` | `Demo@12345!` |
| **Receptionist** | `reception@stayflow.demo` | `Demo@12345!` |
| **Housekeeper** | `housekeeper@stayflow.demo` | `Demo@12345!` |

---

## 4. Getting Started

### 4.1 Prerequisites
- Python 3.11+
- Node.js 18+ and npm
- PostgreSQL 15+ (Running locally on port 5432)
- Redis 7+ (Optional for Celery background alerts; eager mode fallback included)

### 4.2 Database Setup & Migrations
1. Ensure PostgreSQL is running and database `stayflow` exists:
   ```bash
   # Using docker
   docker compose up -d postgres redis
   ```
2. In `apps/api`:
   ```bash
   cd apps/api
   pip install -r requirements.txt
   alembic upgrade head
   python seed.py
   ```

### 4.3 Running the Services

#### 1. Backend API (Port 8000)
```bash
cd apps/api
python main.py
# API live at http://localhost:8000
# OpenAPI Docs available at http://localhost:8000/api/docs
```

#### 2. Admin Web Panel (Port 3000)
```bash
cd apps/admin
npm install
npm run dev
# Web Panel live at http://localhost:3000
```

#### 3. Mobile App (Port 8081)
```bash
cd apps/mobile
npm install
npx expo start
# Press 'w' in terminal to open in web browser at http://localhost:8081
```

---

## 5. Automated Tests

The test suite validates critical business logic:
- Multi-tenant query isolation
- Role-based permission matrices
- Transactional room availability and overlapping reservation prevention
- Pricing engine (hourly, day-use, overnight, daily, overtime grace periods, extra guests)
- Complete check-in to checkout lifecycle and finalized invoice snapshots
- Partial payments and refunds
- Housekeeping room status state transitions

To run all automated backend tests:
```bash
cd apps/api
python -m pytest
```
*Result: 28/28 passed.*

---

## 6. Key Operational Features

- **Fast Receptionist Walk-in**: Instant check-in flow with guest search, room selection, and rate calculations in a few taps.
- **Assistive OCR**: Upload guest ID (NIC/Passport/License) with automatic field extraction and required staff confirmation.
- **Hourly, Day-Use & Overnight Stays**: Dynamic server-side rate calculation with configurable grace periods.
- **Live Folios**: Real-time service charges (food, drinks, laundry, room service) appended to the guest folio during stay.
- **Housekeeping Loop**: Automatic cleaning task dispatch upon checkout; completion marks room `AVAILABLE`.
- **Audit Logs**: Immutable log tracking sensitive actions across the system.
