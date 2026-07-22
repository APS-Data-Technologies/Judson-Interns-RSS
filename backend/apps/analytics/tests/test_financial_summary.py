from datetime import date
from decimal import Decimal

from django.test import TestCase

from apps.accounts.models import User
from apps.analytics.services import build_financial_summary
from apps.reports.models import CostBasis
from apps.sites.models import Location


class FinancialSummaryTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.location_one = Location.objects.create(
            location_name="Downtown",
            address="100 Main Street",
            city="Chicago",
            state="IL",
            zip_code="60601",
        )
        cls.location_two = Location.objects.create(
            location_name="North Campus",
            address="200 North Street",
            city="Chicago",
            state="IL",
            zip_code="60602",
        )
        cls.super_admin = User.objects.create_user(
            email="super@example.com",
            password="StrongPass123!",
            first_name="Super",
            last_name="Admin",
            role=User.Role.SUPER_ADMIN,
        )
        cls.staff = User.objects.create_user(
            email="staff@example.com",
            password="StrongPass123!",
            first_name="Staff",
            last_name="User",
            role=User.Role.STAFF,
            location=cls.location_one,
        )
        for location, month, revenue, cost in (
            (cls.location_one, date(2026, 1, 1), "25000.00", "7000.00"),
            (cls.location_one, date(2026, 2, 1), "26000.00", "8000.00"),
            (cls.location_two, date(2026, 1, 1), "22000.00", "6000.00"),
        ):
            CostBasis.objects.create(
                location=location,
                reporting_month=month,
                cost_type=CostBasis.CostType.REVENUE,
                cost_amount=Decimal(revenue),
            )
            CostBasis.objects.create(
                location=location,
                reporting_month=month,
                cost_type=CostBasis.CostType.EXPENDITURE,
                cost_amount=Decimal(cost),
            )
        CostBasis.objects.create(
            location=cls.location_one,
            reporting_month=date(2026, 1, 1),
            cost_type="Inactive Revenue",
            cost_amount=Decimal("99999.00"),
            is_active=False,
        )

    def test_includes_every_month_touched_by_selected_date_range(self):
        summary = build_financial_summary(
            self.super_admin,
            {},
            date(2026, 1, 15),
            date(2026, 2, 15),
        )

        self.assertEqual(summary["revenue"], Decimal("73000.00"))
        self.assertEqual(summary["cost"], Decimal("21000.00"))
        self.assertEqual(summary["margin"], Decimal("52000.00"))

    def test_location_filter_limits_financial_totals(self):
        summary = build_financial_summary(
            self.super_admin,
            {"location": str(self.location_two.id)},
            date(2026, 1, 1),
            date(2026, 1, 31),
        )

        self.assertEqual(summary["revenue"], Decimal("22000.00"))
        self.assertEqual(summary["cost"], Decimal("6000.00"))
        self.assertEqual(summary["margin"], Decimal("16000.00"))

    def test_staff_is_restricted_to_assigned_location(self):
        summary = build_financial_summary(self.staff, {}, None, None)

        self.assertEqual(summary["revenue"], Decimal("51000.00"))
        self.assertEqual(summary["cost"], Decimal("15000.00"))
        self.assertEqual(summary["margin"], Decimal("36000.00"))
