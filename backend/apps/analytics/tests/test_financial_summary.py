from datetime import date, datetime
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone

from apps.accounts.models import User
from apps.analytics.exports import allowed_pages, export_analytics
from apps.analytics.search import global_search
from apps.analytics.services import (
    build_financial_summary,
    build_financial_trend,
    build_cost_efficiency_trend,
    build_location_financial_performance,
    cohort_analytics,
    compress_rate_trend,
    compress_volume_trend,
)
from apps.reports.models import CostBasis
from apps.leads.models import Family, LeadSource
from apps.sites.models import Location
from apps.tours.models import Tour


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

    def test_financial_trend_returns_monthly_totals_and_margin_rate(self):
        trend = build_financial_trend(
            self.super_admin,
            {"location": str(self.location_one.id)},
            date(2026, 1, 15),
            date(2026, 2, 15),
        )

        self.assertEqual([row["month"] for row in trend], ["2026-01", "2026-02"])
        self.assertEqual(trend[0]["revenue"], Decimal("25000.00"))
        self.assertEqual(trend[0]["cost"], Decimal("7000.00"))
        self.assertEqual(trend[0]["margin"], Decimal("18000.00"))
        self.assertEqual(trend[0]["marginRate"], Decimal("72.00"))

    def test_cost_efficiency_trend_uses_event_date_counts(self):
        financial_trend = build_financial_trend(
            self.super_admin,
            {"location": str(self.location_one.id)},
            date(2026, 1, 1),
            date(2026, 2, 28),
        )
        efficiency = build_cost_efficiency_trend([], financial_trend)

        self.assertEqual(len(efficiency), 2)
        self.assertEqual(efficiency[0]["booked"], 0)
        self.assertIsNone(efficiency[0]["costPerBooked"])
        self.assertIsNone(efficiency[0]["costPerToured"])
        self.assertIsNone(efficiency[0]["costPerEnrollment"])

    def test_location_financial_performance_splits_financial_totals(self):
        rows = build_location_financial_performance(
            self.super_admin,
            {},
            date(2026, 1, 1),
            date(2026, 1, 31),
            [],
        )

        self.assertEqual(len(rows), 2)
        downtown = next(row for row in rows if row["locationName"] == "Downtown")
        self.assertEqual(downtown["revenue"], Decimal("25000.00"))
        self.assertEqual(downtown["cost"], Decimal("7000.00"))
        self.assertEqual(downtown["margin"], Decimal("18000.00"))
        self.assertEqual(downtown["marginRate"], Decimal("72.00"))
        self.assertIsNone(downtown["costPerEnrollment"])

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
        self.assertEqual(analytics["executiveBrief"], {"keyFigures": [], "sections": []})
        self.assertEqual(analytics["executiveBriefs"]["staff"], {"keyFigures": [], "sections": []})
        self.assertEqual(len(analytics["executiveBriefs"]["volume"]["keyFigures"]), 5)
        self.assertEqual(len(analytics["executiveBriefs"]["cohort"]["keyFigures"]), 5)

    def test_admin_analytics_payload_includes_cost_basis_summary(self):
        analytics = cohort_analytics(self.admin, {})

        self.assertEqual(analytics["financialSummary"]["revenue"], Decimal("73000.00"))
        self.assertEqual(analytics["financialSummary"]["cost"], Decimal("21000.00"))
        self.assertEqual(analytics["financialSummary"]["margin"], Decimal("52000.00"))
        self.assertEqual(len(analytics["executiveBriefs"]["staff"]["keyFigures"]), 5)

    def test_admin_executive_brief_uses_explicit_comparison_period(self):
        analytics = cohort_analytics(self.admin, {
            "date_from": "2026-02-01",
            "date_to": "2026-02-28",
            "comparison_date_from": "2026-01-01",
            "comparison_date_to": "2026-01-31",
        })

        self.assertEqual(len(analytics["executiveBrief"]["keyFigures"]), 5)
        self.assertTrue(analytics["executiveBrief"]["sections"])

    def test_excel_export_is_generated_for_authorized_pages(self):
        content, content_type, filename = export_analytics(self.admin, {
            "coverage": "all",
            "dataScope": "current",
            "filters": {"date_from": "2026-01-01", "date_to": "2026-02-28"},
            "format": "xlsx",
            "page": "volume",
        })

        self.assertTrue(content.startswith(b"PK"))
        self.assertIn("spreadsheetml", content_type)
        self.assertEqual(filename, "analytics-data.xlsx")

    def test_pdf_export_is_generated_and_staff_pages_remain_restricted(self):
        content, content_type, filename = export_analytics(self.staff, {
            "coverage": "all",
            "filters": {},
            "format": "pdf",
            "page": "staff",
        })

        self.assertTrue(content.startswith(b"%PDF"))
        self.assertEqual(content_type, "application/pdf")
        self.assertEqual(
            filename,
            "RSS Analytics - All Pages - Current View - Current Filtered Data.pdf",
        )
        self.assertNotIn("staff", allowed_pages(self.staff))
        self.assertNotIn("cost-margin", allowed_pages(self.staff))

        admin_content, _, admin_filename = export_analytics(self.admin, {
            "coverage": "current",
            "dataScope": "current",
            "filters": {"date_from": "2026-01-01", "date_to": "2026-02-28"},
            "format": "pdf",
            "page": "cost-margin",
            "viewScope": "current",
        })
        self.assertTrue(admin_content.startswith(b"%PDF"))
        self.assertEqual(
            admin_filename,
            "RSS Analytics - Costs & Margin - Current View - Current Filtered Data.pdf",
        )

    def test_global_search_scopes_records_and_staff_results_by_role(self):
        source = LeadSource.objects.create(source_name="Community Search")
        local_family = Family.objects.create(family_name="Smith Local")
        other_family = Family.objects.create(family_name="Smith Remote")
        Tour.objects.create(
            family=local_family,
            location=self.location_one,
            lead_source=source,
            assigned_staff=self.staff,
            scheduled_tour_date=timezone.make_aware(datetime(2026, 2, 3, 10, 0)),
        )
        Tour.objects.create(
            family=other_family,
            location=self.location_two,
            lead_source=source,
            assigned_staff=self.other_staff,
            scheduled_tour_date=timezone.make_aware(datetime(2026, 2, 4, 10, 0)),
        )

        staff_results = global_search(self.staff, "Smith")
        admin_results = global_search(self.admin, "Smith")

        self.assertEqual([row["title"] for row in staff_results["families"]], ["Smith Local"])
        self.assertEqual(staff_results["staff"], [])
        self.assertCountEqual(
            [row["title"] for row in admin_results["families"]],
            ["Smith Local", "Smith Remote"],
        )

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
