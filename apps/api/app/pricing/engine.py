"""
StayFlow Pricing Engine.

This is a pure function module — no database side effects.
All pricing calculations happen here, isolated from controllers.

Business rules:
- HOURLY: base_hourly_rate × billable_hours
- DAY_USE: flat base_day_use_rate (+ overtime if checked out late)
- OVERNIGHT: base_nightly_rate (+ extra nights if extended)
- DAILY: base_daily_rate × number_of_days

Overtime:
- Applied when actual_checkout > expected_checkout
- Grace period (default 30 min) before charging
- Charged per hour at extra_hour_rate (or pro-rated)

Extra guests:
- extra_guest_rate × (num_guests - 1) per night/day/hour-block
"""
from dataclasses import dataclass, field
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, timedelta
from typing import Optional
import math


@dataclass
class PricingInput:
    stay_type: str  # HOURLY, DAY_USE, OVERNIGHT, DAILY
    actual_check_in: datetime
    expected_checkout: datetime
    actual_checkout: datetime  # for final calculation; use expected for estimates
    num_guests: int
    max_guests_included: int  # from room type

    base_hourly_rate: Decimal
    base_day_use_rate: Decimal
    base_nightly_rate: Decimal
    base_daily_rate: Decimal
    extra_hour_rate: Decimal
    extra_guest_rate: Decimal

    discount: Decimal = Decimal("0")
    tax_rate: Decimal = Decimal("0")  # percentage, e.g. 0.10 for 10%
    service_charge_rate: Decimal = Decimal("0")  # percentage

    # Grace period before overtime kicks in (minutes)
    overtime_grace_minutes: int = 30

    # Existing folio services total (added before finalization)
    services_total: Decimal = Decimal("0")


@dataclass
class PricingBreakdownItem:
    label: str
    amount: Decimal
    is_deduction: bool = False


@dataclass
class PricingResult:
    room_charge: Decimal
    extra_hour_charge: Decimal
    extra_guest_charge: Decimal
    services_total: Decimal
    service_charge: Decimal  # percentage-based service charge
    discount: Decimal
    tax: Decimal
    subtotal: Decimal
    grand_total: Decimal
    paid_amount: Decimal = Decimal("0")
    balance: Decimal = Decimal("0")
    breakdown: list[PricingBreakdownItem] = field(default_factory=list)

    def with_payment(self, paid_amount: Decimal) -> "PricingResult":
        self.paid_amount = paid_amount
        self.balance = max(Decimal("0"), self.grand_total - paid_amount)
        return self


def _quantize(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _hours_between(start: datetime, end: datetime) -> float:
    """Returns fractional hours between two datetimes."""
    delta = end - start
    return delta.total_seconds() / 3600


def _billable_hours(start: datetime, end: datetime) -> Decimal:
    """
    Calculate billable hours, rounding up to the next hour.
    """
    hours = _hours_between(start, end)
    return Decimal(str(math.ceil(hours)))


def calculate_pricing(inp: PricingInput) -> PricingResult:
    """
    Core pricing calculation.
    Returns a PricingResult with a full breakdown.
    """
    breakdown: list[PricingBreakdownItem] = []
    room_charge = Decimal("0")
    extra_hour_charge = Decimal("0")
    extra_guest_charge = Decimal("0")

    # -------------------------------------------------------
    # 1. Base room charge by stay type
    # -------------------------------------------------------
    if inp.stay_type == "HOURLY":
        # Bill from check-in to expected checkout
        billable = _billable_hours(inp.actual_check_in, inp.expected_checkout)
        room_charge = _quantize(inp.base_hourly_rate * billable)
        breakdown.append(PricingBreakdownItem(
            label=f"Room charge ({billable} hr{'s' if billable != 1 else ''} × {inp.base_hourly_rate})",
            amount=room_charge,
        ))

    elif inp.stay_type == "DAY_USE":
        room_charge = _quantize(inp.base_day_use_rate)
        breakdown.append(PricingBreakdownItem(
            label="Day-use rate",
            amount=room_charge,
        ))

    elif inp.stay_type == "OVERNIGHT":
        # Calculate number of nights
        delta_days = (inp.expected_checkout.date() - inp.actual_check_in.date()).days
        if delta_days <= 0:
            hours = _hours_between(inp.actual_check_in, inp.expected_checkout)
            nights = max(1, math.ceil(hours / 24))
        else:
            nights = max(1, delta_days)

        room_charge = _quantize(inp.base_nightly_rate * nights)
        breakdown.append(PricingBreakdownItem(
            label=f"Nightly rate ({nights} night{'s' if nights != 1 else ''} × {inp.base_nightly_rate})",
            amount=room_charge,
        ))

    elif inp.stay_type == "DAILY":
        # Number of calendar nights / days
        nights = max(1, (inp.expected_checkout.date() - inp.actual_check_in.date()).days)
        room_charge = _quantize(inp.base_daily_rate * nights)
        breakdown.append(PricingBreakdownItem(
            label=f"Daily rate ({nights} night{'s' if nights != 1 else ''} × {inp.base_daily_rate})",
            amount=room_charge,
        ))

    # -------------------------------------------------------
    # 2. Overtime calculation
    # -------------------------------------------------------
    if inp.actual_checkout > inp.expected_checkout:
        overtime_start = inp.expected_checkout + timedelta(minutes=inp.overtime_grace_minutes)
        if inp.actual_checkout > overtime_start:
            overtime_hours = _billable_hours(overtime_start, inp.actual_checkout)
            if overtime_hours > 0:
                extra_hour_charge = _quantize(inp.extra_hour_rate * overtime_hours)
                breakdown.append(PricingBreakdownItem(
                    label=f"Overtime ({overtime_hours} hr{'s' if overtime_hours != 1 else ''} × {inp.extra_hour_rate})",
                    amount=extra_hour_charge,
                ))

    # -------------------------------------------------------
    # 3. Extra guests
    # -------------------------------------------------------
    extra_guests = max(0, inp.num_guests - inp.max_guests_included)
    # Effective extra guest rate: use configured rate or default to 25% of base rate
    effective_extra_rate = inp.extra_guest_rate if inp.extra_guest_rate > 0 else _quantize((inp.base_nightly_rate if inp.base_nightly_rate > 0 else inp.base_hourly_rate * 4) * Decimal("0.25"))
    if extra_guests > 0 and effective_extra_rate > 0:
        # For daily/overnight: per night; for hourly/day-use: flat
        if inp.stay_type in ("DAILY", "OVERNIGHT"):
            delta_days = (inp.expected_checkout.date() - inp.actual_check_in.date()).days
            nights = max(1, delta_days)
            extra_guest_charge = _quantize(effective_extra_rate * extra_guests * nights)
            breakdown.append(PricingBreakdownItem(
                label=f"Extra guests ({extra_guests} × {nights} night{'s' if nights != 1 else ''} × {effective_extra_rate})",
                amount=extra_guest_charge,
            ))
        else:
            extra_guest_charge = _quantize(effective_extra_rate * extra_guests)
            breakdown.append(PricingBreakdownItem(
                label=f"Extra guests ({extra_guests} × {effective_extra_rate})",
                amount=extra_guest_charge,
            ))

    # -------------------------------------------------------
    # 4. Services
    # -------------------------------------------------------
    if inp.services_total > 0:
        breakdown.append(PricingBreakdownItem(
            label="Additional services",
            amount=_quantize(inp.services_total),
        ))

    # -------------------------------------------------------
    # 5. Service charge (percentage of room + services)
    # -------------------------------------------------------
    base_for_service_charge = room_charge + extra_hour_charge + extra_guest_charge + inp.services_total
    service_charge = _quantize(base_for_service_charge * inp.service_charge_rate)
    if service_charge > 0:
        breakdown.append(PricingBreakdownItem(
            label=f"Service charge ({inp.service_charge_rate * 100:.0f}%)",
            amount=service_charge,
        ))

    # -------------------------------------------------------
    # 6. Discount
    # -------------------------------------------------------
    discount = _quantize(inp.discount)
    if discount > 0:
        breakdown.append(PricingBreakdownItem(
            label="Discount",
            amount=discount,
            is_deduction=True,
        ))

    # -------------------------------------------------------
    # 7. Tax
    # -------------------------------------------------------
    subtotal_before_tax = (
        room_charge + extra_hour_charge + extra_guest_charge
        + inp.services_total + service_charge - discount
    )
    tax = _quantize(max(Decimal("0"), subtotal_before_tax) * inp.tax_rate)
    if tax > 0:
        breakdown.append(PricingBreakdownItem(
            label=f"Tax ({inp.tax_rate * 100:.0f}%)",
            amount=tax,
        ))

    # -------------------------------------------------------
    # 8. Totals
    # -------------------------------------------------------
    subtotal = _quantize(subtotal_before_tax)
    grand_total = _quantize(subtotal + tax)

    return PricingResult(
        room_charge=room_charge,
        extra_hour_charge=extra_hour_charge,
        extra_guest_charge=extra_guest_charge,
        services_total=_quantize(inp.services_total),
        service_charge=service_charge,
        discount=discount,
        tax=tax,
        subtotal=subtotal,
        grand_total=grand_total,
        breakdown=breakdown,
    )
