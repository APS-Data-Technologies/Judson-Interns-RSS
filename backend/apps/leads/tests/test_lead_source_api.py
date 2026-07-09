from django.urls import reverse
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.leads.models import LeadSource


class LeadSourceApiTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.website = LeadSource.objects.create(
            external_id="src-001",
            source_name="Website",
            description="Main website",
        )
        cls.referral = LeadSource.objects.create(
            external_id="src-002",
            source_name="Referral",
            description="Family referral",
            is_active=False,
        )
        cls.staff = cls.create_user(
            email="staff@example.com",
            password="StrongPass123!",
            role=User.Role.STAFF,
        )
        cls.admin = cls.create_user(
            email="admin@example.com",
            password="StrongPass123!",
            role=User.Role.ADMIN,
        )
        cls.super_admin = cls.create_user(
            email="super@example.com",
            password="StrongPass123!",
            role=User.Role.SUPER_ADMIN,
        )

    @staticmethod
    def create_user(email, password, role):
        user = User(
            email=email,
            first_name="Test",
            last_name="User",
            role=role,
        )
        user.set_password(password)
        user.save()
        return user

    def authenticate(self, user):
        token = Token.objects.create(user=user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
        return token

    def test_public_lead_source_list_requires_authentication(self):
        response = self.client.get(reverse("lead-source-list"))

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_public_lead_source_list_returns_only_active_sources(self):
        self.authenticate(self.staff)
        response = self.client.get(reverse("lead-source-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["source_name"], self.website.source_name)

    def test_staff_cannot_manage_lead_sources(self):
        self.authenticate(self.staff)
        response = self.client.get(reverse("manage-lead-source-list"))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_list_inactive_sources_for_management(self):
        self.authenticate(self.admin)
        response = self.client.get(
            reverse("manage-lead-source-list"),
            {"include_inactive": "true"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_admin_can_create_lead_source(self):
        self.authenticate(self.admin)
        response = self.client.post(
            reverse("manage-lead-source-list"),
            {
                "external_id": "src-003",
                "source_name": "Community Fair",
                "description": "Local event",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["source_name"], "Community Fair")

    def test_super_admin_can_update_lead_source(self):
        self.authenticate(self.super_admin)
        response = self.client.patch(
            reverse("manage-lead-source-detail", args=[self.website.id]),
            {
                "description": "Updated website",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.website.refresh_from_db()
        self.assertEqual(self.website.description, "Updated website")

    def test_admin_can_reactivate_inactive_source(self):
        self.authenticate(self.admin)
        response = self.client.patch(
            reverse("manage-lead-source-detail", args=[self.referral.id]),
            {"is_active": True},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.referral.refresh_from_db()
        self.assertTrue(self.referral.is_active)

    def test_duplicate_lead_source_name_is_rejected_case_insensitively(self):
        self.authenticate(self.super_admin)
        response = self.client.post(
            reverse("manage-lead-source-list"),
            {
                "source_name": "website",
                "description": "Duplicate",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("source_name", response.data)
