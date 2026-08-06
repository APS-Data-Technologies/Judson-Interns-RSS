from datetime import date
from decimal import Decimal

from django.urls import reverse
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.reports.models import CostBasis
from apps.sites.models import Location


class CostBasisApiTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.location = Location.objects.create(
            location_name="Downtown",
            address="100 Main Street",
            city="Chicago",
            state="IL",
            zip_code="60601",
        )
        cls.super_admin = User.objects.create_user(
            email="super@example.com",
            password="StrongPass123!",
            first_name="Super",
            last_name="Admin",
            role=User.Role.SUPER_ADMIN,
        )
        cls.admin = User.objects.create_user(
            email="admin@example.com",
            password="StrongPass123!",
            first_name="Regular",
            last_name="Admin",
            role=User.Role.ADMIN,
        )
        cls.entry = CostBasis.objects.create(
            external_id="COST-existing",
            location=cls.location,
            reporting_month=date(2026, 1, 1),
            cost_type=CostBasis.CostType.REVENUE,
            cost_amount=Decimal("25000.00"),
        )

    def authenticate(self, user):
        token = Token.objects.create(user=user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

    def test_super_admin_can_list_cost_basis(self):
        self.authenticate(self.super_admin)
        response = self.client.get(reverse("cost-basis-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["location_name"], "Downtown")

    def test_admin_cannot_manage_cost_basis(self):
        self.authenticate(self.admin)
        response = self.client.get(reverse("cost-basis-list"))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_super_admin_can_create_entry_with_generated_external_id(self):
        self.authenticate(self.super_admin)
        response = self.client.post(
            reverse("cost-basis-list"),
            {
                "location": self.location.id,
                "reporting_month": "2026-02-01",
                "cost_type": "Expenditure",
                "cost_amount": "7000.50",
                "notes": "February operating costs",
                "is_active": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["external_id"].startswith("COST-"))

    def test_super_admin_can_edit_and_deactivate_entry(self):
        self.authenticate(self.super_admin)
        response = self.client.patch(
            reverse("cost-basis-detail", args=[self.entry.id]),
            {"cost_amount": "26000.00", "is_active": False},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.entry.refresh_from_db()
        self.assertEqual(self.entry.cost_amount, Decimal("26000.00"))
        self.assertFalse(self.entry.is_active)

    def test_non_month_start_date_is_rejected(self):
        self.authenticate(self.super_admin)
        response = self.client.post(
            reverse("cost-basis-list"),
            {
                "location": self.location.id,
                "reporting_month": "2026-02-15",
                "cost_type": "Revenue",
                "cost_amount": "24000.00",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("reporting_month", response.data)

    def test_invalid_cost_type_is_rejected(self):
        self.authenticate(self.super_admin)
        response = self.client.post(
            reverse("cost-basis-list"),
            {
                "location": self.location.id,
                "reporting_month": "2026-02-01",
                "cost_type": "Advertising",
                "cost_amount": "1000.00",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cost_type", response.data)
