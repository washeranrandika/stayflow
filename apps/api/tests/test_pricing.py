"""Tests for the pricing engine — pure functions, no DB needed."""
import pytest
from decimal import Decimal
from datetime import datetime, timezone, timedelta

from app.pricing.engine import PricingInput, calculate_pricing


def make_input(**kwargs) -> PricingInput:
    now = datetime(2025, 9, 21, 14, 0, 0, tzinfo=timezone.utc)
    defaults = dict(
        stay_type="OVERNIGHT",
        actual_check_in=now,
        expected_checkout=now + timedelta(hours=21),
        actual_checkout=now + timedelta(hours=21),
        num_guests=1,
        max_guests_included=2,
        base_hourly_rate=Decimal("1000"),
        base_day_use_rate=Decimal("3000"),
        base_nightly_rate=Decimal("5000"),
        base_daily_rate=Decimal("5000"),
        extra_hour_rate=Decimal("500"),
        extra_guest_rate=Decimal("500"),
        discount=Decimal("0"),
        tax_rate=Decimal("0"),
        service_charge_rate=Decimal("0"),
        services_total=Decimal("0"),
        overtime_grace_minutes=30,
    )
    defaults.update(kwargs)
    return PricingInput(**defaults)


class TestHourlyPricing:
    def test_basic_hourly(self):
        now = datetime(2025, 9, 21, 10, 0, tzinfo=timezone.utc)
        inp = make_input(
            stay_type="HOURLY",
            actual_check_in=now,
            expected_checkout=now + timedelta(hours=3),
            actual_checkout=now + timedelta(hours=3),
        )
        result = calculate_pricing(inp)
        # 3 hours × 1000 = 3000
        assert result.room_charge == Decimal("3000")
        assert result.extra_hour_charge == Decimal("0")
        assert result.grand_total == Decimal("3000")

    def test_hourly_rounds_up(self):
        """Partial hour should be rounded up to full hour."""
        now = datetime(2025, 9, 21, 10, 0, tzinfo=timezone.utc)
        inp = make_input(
            stay_type="HOURLY",
            actual_check_in=now,
            expected_checkout=now + timedelta(hours=2, minutes=30),
            actual_checkout=now + timedelta(hours=2, minutes=30),
        )
        result = calculate_pricing(inp)
        # 2.5 hours → 3 billable hours × 1000 = 3000
        assert result.room_charge == Decimal("3000")

    def test_hourly_overtime(self):
        """Late checkout after grace period incurs extra hour charge."""
        now = datetime(2025, 9, 21, 10, 0, tzinfo=timezone.utc)
        expected = now + timedelta(hours=3)
        actual = expected + timedelta(hours=2)  # 2 hours late
        inp = make_input(
            stay_type="HOURLY",
            actual_check_in=now,
            expected_checkout=expected,
            actual_checkout=actual,
        )
        result = calculate_pricing(inp)
        # 3 hrs base + 2 hrs overtime × 500 = 3000 + 1000
        assert result.extra_hour_charge == Decimal("1000")
        assert result.grand_total == Decimal("4000")

    def test_hourly_within_grace_period(self):
        """Checkout within grace period does NOT incur overtime charge."""
        now = datetime(2025, 9, 21, 10, 0, tzinfo=timezone.utc)
        expected = now + timedelta(hours=3)
        actual = expected + timedelta(minutes=20)  # within 30-min grace
        inp = make_input(
            stay_type="HOURLY",
            actual_check_in=now,
            expected_checkout=expected,
            actual_checkout=actual,
        )
        result = calculate_pricing(inp)
        assert result.extra_hour_charge == Decimal("0")


class TestDayUsePricing:
    def test_day_use_flat_rate(self):
        now = datetime(2025, 9, 21, 10, 0, tzinfo=timezone.utc)
        inp = make_input(
            stay_type="DAY_USE",
            actual_check_in=now,
            expected_checkout=now + timedelta(hours=8),
            actual_checkout=now + timedelta(hours=8),
        )
        result = calculate_pricing(inp)
        assert result.room_charge == Decimal("3000")
        assert result.grand_total == Decimal("3000")

    def test_day_use_overtime(self):
        now = datetime(2025, 9, 21, 10, 0, tzinfo=timezone.utc)
        expected = now + timedelta(hours=8)
        actual = expected + timedelta(hours=1, minutes=30)
        inp = make_input(
            stay_type="DAY_USE",
            actual_check_in=now,
            expected_checkout=expected,
            actual_checkout=actual,
        )
        result = calculate_pricing(inp)
        # Grace 30 min → 1 overtime hour → 500
        assert result.extra_hour_charge == Decimal("500")


class TestOvernightPricing:
    def test_overnight_basic(self):
        inp = make_input(stay_type="OVERNIGHT")
        result = calculate_pricing(inp)
        assert result.room_charge == Decimal("5000")
        assert result.grand_total == Decimal("5000")


class TestDailyPricing:
    def test_daily_3_nights(self):
        now = datetime(2025, 9, 21, 14, 0, tzinfo=timezone.utc)
        inp = make_input(
            stay_type="DAILY",
            actual_check_in=now,
            expected_checkout=now + timedelta(days=3),
            actual_checkout=now + timedelta(days=3),
        )
        result = calculate_pricing(inp)
        # 3 nights × 5000 = 15000
        assert result.room_charge == Decimal("15000")

    def test_daily_5_nights(self):
        now = datetime(2025, 9, 21, 14, 0, tzinfo=timezone.utc)
        inp = make_input(
            stay_type="DAILY",
            actual_check_in=now,
            expected_checkout=now + timedelta(days=5),
            actual_checkout=now + timedelta(days=5),
        )
        result = calculate_pricing(inp)
        assert result.room_charge == Decimal("25000")


class TestExtraGuests:
    def test_extra_guest_charge_overnight(self):
        inp = make_input(
            stay_type="OVERNIGHT",
            num_guests=3,
            max_guests_included=2,
        )
        result = calculate_pricing(inp)
        # 1 extra guest × 500 = 500
        assert result.extra_guest_charge == Decimal("500")

    def test_no_extra_guest_within_limit(self):
        inp = make_input(num_guests=2, max_guests_included=2)
        result = calculate_pricing(inp)
        assert result.extra_guest_charge == Decimal("0")


class TestDiscountAndTax:
    def test_discount_applied(self):
        inp = make_input(stay_type="OVERNIGHT", discount=Decimal("1000"))
        result = calculate_pricing(inp)
        # 5000 - 1000 = 4000
        assert result.discount == Decimal("1000")
        assert result.grand_total == Decimal("4000")

    def test_tax_calculated(self):
        inp = make_input(stay_type="OVERNIGHT", tax_rate=Decimal("0.10"))
        result = calculate_pricing(inp)
        # 5000 + 500 tax = 5500
        assert result.tax == Decimal("500.00")
        assert result.grand_total == Decimal("5500.00")

    def test_tax_after_discount(self):
        inp = make_input(
            stay_type="OVERNIGHT",
            discount=Decimal("1000"),
            tax_rate=Decimal("0.10"),
        )
        result = calculate_pricing(inp)
        # (5000 - 1000) = 4000 subtotal, tax = 400
        assert result.tax == Decimal("400.00")
        assert result.grand_total == Decimal("4400.00")


class TestServicesInPricing:
    def test_services_added_to_total(self):
        inp = make_input(
            stay_type="OVERNIGHT",
            services_total=Decimal("2500"),
        )
        result = calculate_pricing(inp)
        assert result.services_total == Decimal("2500")
        assert result.grand_total == Decimal("7500")

    def test_full_calculation(self):
        """Integration: overnight + overtime + services + extra guest + tax."""
        now = datetime(2025, 9, 21, 14, 0, tzinfo=timezone.utc)
        expected = now + timedelta(hours=21)
        actual = expected + timedelta(hours=2)  # 2 hrs overtime

        inp = make_input(
            stay_type="OVERNIGHT",
            actual_check_in=now,
            expected_checkout=expected,
            actual_checkout=actual,
            num_guests=3,
            max_guests_included=2,
            services_total=Decimal("1800"),
            tax_rate=Decimal("0.10"),
        )
        result = calculate_pricing(inp)
        # room: 5000
        # overtime: 2 hrs × 500 = 1000
        # extra guest: 1 × 500 = 500
        # services: 1800
        # tax (10% of 5000+1000+500+1800): 10% of 8300 = 830
        assert result.room_charge == Decimal("5000")
        assert result.extra_hour_charge == Decimal("1000")
        assert result.extra_guest_charge == Decimal("500")
        assert result.services_total == Decimal("1800")
        assert result.tax == Decimal("830.00")
        assert result.grand_total == Decimal("9130.00")
