from datetime import date
from decimal import Decimal

from django.test import TestCase

from apps.accounts.models import User
from apps.analytics.services import (
    build_financial_summary,
    cohort_analytics,
    compress_rate_trend,
    compress_volume_trend,
)
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
        cls.admin = User.objects.create_user(
            email="admin@example.com",
            password="StrongPass123!",
            first_name="Admin",
            last_name="User",
            role=User.Role.ADMIN,
        )
        cls.other_staff = User.objects.create_user(
            email="other-staff@example.com",
            password="StrongPass123!",
            first_name="Other",
            last_name="Staff",
            role=User.Role.STAFF,
            location=cls.location_two,
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

    def test_selected_staff_limits_totals_to_staff_location(self):
        summary = build_financial_summary(
            self.super_admin,
            {"staff": str(self.other_staff.id)},
            None,
            None,
        )

        self.assertEqual(summary["revenue"], Decimal("22000.00"))
        self.assertEqual(summary["cost"], Decimal("6000.00"))
        self.assertEqual(summary["margin"], Decimal("16000.00"))

    def test_staff_and_location_filters_are_intersected(self):
        summary = build_financial_summary(
            self.super_admin,
            {
                "staff": str(self.other_staff.id),
                "location": str(self.location_one.id),
            },
            None,
            None,
        )

        self.assertEqual(summary["revenue"], 0)
        self.assertEqual(summary["cost"], 0)
        self.assertEqual(summary["margin"], 0)

    def test_staff_analytics_payload_excludes_restricted_sections(self):
        analytics = cohort_analytics(self.staff, {})

        self.assertEqual(analytics["financialSummary"], {"revenue": 0, "cost": 0, "margin": 0})
        self.assertEqual(analytics["rankings"]["staff"], [])
        self.assertEqual(analytics["allTimeRankings"]["staff"], [])
        self.assertEqual(analytics["volumePerformanceRankings"]["staff"], [])
        self.assertEqual(analytics["allTimeVolumePerformanceRankings"]["staff"], [])
        self.assertEqual(analytics["entityHealth"]["staff"], [])

    def test_admin_analytics_payload_includes_cost_basis_summary(self):
        analytics = cohort_analytics(self.admin, {})

        self.assertEqual(analytics["financialSummary"]["revenue"], Decimal("73000.00"))
        self.assertEqual(analytics["financialSummary"]["cost"], Decimal("21000.00"))
        self.assertEqual(analytics["financialSummary"]["margin"], Decimal("52000.00"))

    def test_volume_trend_compresses_full_period_without_losing_totals(self):
        rows = [
            {
                "date": f"2026-06-{day:02d}",
                "booked": 1 if day <= 6 else 0,
                "toured": 0,
                "noShow": 0,
                "enrolled": 0,
                "churned": 0,
            }
            for day in range(1, 31)
        ]

        compressed = compress_volume_trend(rows)

        self.assertLessEqual(len(compressed), 12)
        self.assertEqual(sum(row["booked"] for row in compressed), 6)

    def test_rate_trend_recalculates_rates_after_compression(self):
        rows = [
            {
                "date": f"2026-06-{day:02d}",
                "booked": 2,
                "toured": 1,
                "noShow": 1,
                "enrolled": 1,
                "churned": 0,
                "averageDaysCount": 1,
                "averageDaysToEnroll": 4,
            }
            for day in range(1, 31)
        ]

        compressed = compress_rate_trend(rows)

        self.assertLessEqual(len(compressed), 12)
        self.assertTrue(all(row["touredRate"] == 50 for row in compressed))
        self.assertTrue(all(row["conversionRate"] == 100 for row in compressed))
