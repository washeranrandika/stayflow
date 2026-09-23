# StayFlow Business Rules Specification

## 1. Room Availability & Booking Overlap Rules

### 1.1 Overlap Detection Logic
A room is considered **unavailable** for a requested window `[start_req, end_req]` if there exists any active reservation or stay on that room where:
```sql
check_in < end_req AND checkout > start_req
```
And the reservation status is in `('CONFIRMED', 'CHECKED_IN')`, or an active stay exists with `is_completed = FALSE`.

### 1.2 Adjacent Bookings
- Booking A ending on date `D` at 11:00 AM and Booking B starting on date `D` at 14:00 PM are **non-overlapping** and fully permitted.
- The 3-hour buffer between standard checkout (11:00 AM) and standard check-in (2:00 PM) accommodates the housekeeping cleaning turnaround.

---

## 2. Stay Types & Pricing Engine

### 2.1 Stay Types
1. **HOURLY**: Stays billed on an hourly increments (e.g. 2 hours, 3 hours, 6 hours).
2. **DAY_USE**: Typical daytime usage (e.g. 10:00 AM to 6:00 PM).
3. **OVERNIGHT**: Standard 1-night stay (Check-in: 2:00 PM, Checkout: 11:00 AM next day).
4. **DAILY**: Multi-day overnight stays.

### 2.2 Pricing Calculation Formulas

#### Hourly Pricing
```
Billable Hours = ceil((Actual Checkout - Actual Check-in) in minutes / 60)
Room Charge = Billable Hours * Base Hourly Rate
```
*Rule: Any partial hour is rounded up to the nearest full hour.*

#### Day Use Pricing
```
Room Charge = Base Day Use Rate
If Actual Checkout > Expected Checkout:
    Overtime Minutes = (Actual Checkout - Expected Checkout) in minutes
    If Overtime Minutes > Grace Period (30 min):
        Extra Hours = ceil(Overtime Minutes / 60)
        Extra Charge = Extra Hours * Extra Hour Rate
```

#### Overnight & Daily Pricing
```
Nights = ceil((Expected Checkout Date - Check-in Date).days)
Room Charge = Nights * Base Nightly Rate
If Actual Checkout Time > Expected Checkout Time (11:00 AM):
    Overtime Minutes = (Actual Checkout - Expected Checkout) in minutes
    If Overtime Minutes > Grace Period (30 min):
        Extra Hours = ceil(Overtime Minutes / 60)
        Extra Charge = Extra Hours * Extra Hour Rate
```

#### Extra Guest Charges
```
Extra Guests = max(0, Num Guests - Max Included Guests)
Extra Guest Charge = Extra Guests * Extra Guest Rate * Duration Units
```

#### Total Bill Formula
```
Subtotal = Room Charge + Extra Hour Charge + Extra Guest Charge + Services Total
Service Charge = Subtotal * (Service Charge Rate %)
Tax = (Subtotal + Service Charge) * (Tax Rate %)
Grand Total = Subtotal + Service Charge + Tax - Discount
```

---

## 3. Checkout & Housekeeping Transitions

1. **State Transition on Checkout**:
   ```
   Room Status: OCCUPIED ──> CLEANING
   Stay Status: ACTIVE   ──> COMPLETED
   Folio Status: OPEN    ──> FINALIZED
   Invoice: Finalized with snapshot values
   Housekeeping Task: PENDING created automatically
   ```
2. **Housekeeping Task Completion**:
   - Only a user with `housekeeping.update` permission can mark a task `COMPLETED`.
   - When marked `COMPLETED`, the room automatically transitions:
   ```
   Room Status: CLEANING ──> AVAILABLE
   ```
   - Room status and housekeeping tasks are tracked as distinct entities for operational clarity.

---

## 4. Billing & Financial Rules

### 4.1 Invoice Finalization & Snapshot Immutability
- Once checkout is confirmed, the invoice is **finalized**.
- **Rule**: Historical invoices must NEVER change their charged amounts even if property managers adjust room rates in the future.
- All line items, rates, taxes, and discounts are captured as snapshot copies on `invoice` and `folio_items`.

### 4.2 Payments & Refunds
- An invoice can have **multiple payment records** across different methods (`CASH`, `CARD`, `BANK_TRANSFER`, `QR`).
- **Rule**: Total payments cannot exceed the invoice grand total (preventing overpayment).
- **Rule**: A refund cannot exceed the original payment amount.
- **Balance Calculation**:
  ```
  Paid So Far = Sum(Payment.amount) - Sum(Refund.amount)
  Balance Due = Grand Total - Paid So Far
  ```

---

## 5. Sensitive ID Document Retention & Verification Rules

1. **OCR is NOT Verification**:
   - OCR is strictly an assistive text-extraction tool.
   - All extracted fields (`full_name`, `document_number`, `dob`) must be verified and approved by a staff member before `GuestVerification` is marked `CONFIRMED`.
2. **Private Storage Only**:
   - Documents are stored in encrypted private buckets. Public URLs are forbidden.
   - Viewing uses presigned URLs with an expiration time of 300 seconds (5 minutes).
3. **Audit Trail**:
   - Every document upload, view, and deletion generates an immutable audit record containing user ID, timestamp, and IP address.
