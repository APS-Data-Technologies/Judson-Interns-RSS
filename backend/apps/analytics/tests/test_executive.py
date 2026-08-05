from django.test import SimpleTestCase

from apps.analytics.executive import (
    build_costs_margin_executive_brief,
    build_entity_executive_brief,
    build_volume_executive_brief,
)


class ExecutiveBriefTests(SimpleTestCase):
    def test_cost_brief_uses_two_ceo_sections_and_qualified_entities(self):
        brief = build_costs_margin_executive_brief(
            {"revenue": 700000, "cost": 300000, "margin": 400000},
            {"revenue": 600000, "cost": 300000, "margin": 300000},
            {"enrolled": 200, "toured": 200},
            {"enrolled": 180, "toured": 200},
            {"conversion": 50.0},
            {"conversion": 45.0},
            [{"month": "2026-07", "hasRevenue": True, "hasCost": True, "margin": 400000}],
            [
                {
                    "locationId": 1,
                    "locationName": "Naperville",
                    "margin": 220000,
                    "toured": 100,
                    "conversionRate": 60.0,
                },
                {
                    "locationId": 2,
                    "locationName": "Schaumburg",
                    "margin": 180000,
                    "toured": 100,
                    "conversionRate": 40.0,
                },
            ],
        )

        self.assertEqual(
            [section["key"] for section in brief["sections"]],
            ["highlights", "risks"],
        )
        self.assertEqual(
            [section["title"] for section in brief["sections"]],
            ["Performance Highlights", "Priorities & Risks"],
        )
        highlights = " ".join(brief["sections"][0]["items"])
        risks = " ".join(brief["sections"][1]["items"])
        self.assertIn("increased by $100,000", highlights)
        self.assertIn("Naperville is the conversion performance leader", highlights)
        self.assertNotIn("33.3%", highlights)
        self.assertIn("Schaumburg is an improvement focus", risks)

    def test_immaterial_volume_changes_stay_quiet(self):
        brief = build_volume_executive_brief(
            {"scheduled": 101, "toured": 80, "no_show": 5, "enrolled": 40, "churned": 4},
            {"scheduled": 100, "toured": 80, "no_show": 5, "enrolled": 40, "churned": 4},
            [],
        )

        self.assertEqual(
            brief["sections"][0]["items"],
            ["No material performance improvements were identified for the selected period."],
        )
        self.assertEqual(
            brief["sections"][1]["items"],
            ["No material priorities or risks were identified from the selected data."],
        )

    def test_entity_brief_limits_rankings_to_qualified_entities(self):
        brief = build_entity_executive_brief(
            [
                {
                    "name": "Naperville",
                    "volume": {"booked": 30, "enrolled": 12},
                    "toured": 20,
                    "enrolled": 12,
                    "previousToured": 20,
                    "previousEnrolled": 9,
                    "pendingTourOutcome": 0,
                    "pendingEnrollmentOutcome": 0,
                },
                {
                    "name": "Schaumburg",
                    "volume": {"booked": 30, "enrolled": 6},
                    "toured": 20,
                    "enrolled": 6,
                    "previousToured": 20,
                    "previousEnrolled": 9,
                    "pendingTourOutcome": 4,
                    "pendingEnrollmentOutcome": 2,
                },
                {
                    "name": "Small Sample",
                    "volume": {"booked": 4, "enrolled": 4},
                    "toured": 4,
                    "enrolled": 4,
                    "previousToured": 4,
                    "previousEnrolled": 1,
                    "pendingTourOutcome": 0,
                    "pendingEnrollmentOutcome": 0,
                },
            ],
            "Locations",
        )

        highlights = " ".join(brief["sections"][0]["items"])
        risks = " ".join(brief["sections"][1]["items"])
        self.assertIn("Naperville is the conversion performance leader", highlights)
        self.assertIn("Schaumburg is the improvement focus", risks)
        self.assertNotIn("Small Sample", highlights)
        self.assertNotIn("Small Sample", risks)
