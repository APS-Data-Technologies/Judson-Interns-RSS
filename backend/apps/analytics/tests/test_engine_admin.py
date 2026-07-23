from django.urls import reverse
from rest_framework.test import APITestCase

from apps.accounts.models import User

from ..models import AnalyticsOperation


class AnalyticsEngineAdminTests(APITestCase):
    def setUp(self):
        self.staff = User.objects.create_user(
            email="staff@example.com",
            password="test-pass",
            first_name="Staff",
            last_name="User",
            role=User.Role.STAFF,
        )
        self.admin_user = User.objects.create_user(
            email="admin@example.com",
            password="test-pass",
            first_name="Admin",
            last_name="User",
            role=User.Role.ADMIN,
        )
        self.super_admin = User.objects.create_user(
            email="super@example.com",
            password="test-pass",
            first_name="Super",
            last_name="Admin",
            role=User.Role.SUPER_ADMIN,
        )
        self.url = reverse("analytics-engine-admin")

    def test_staff_cannot_view_engine_administration(self):
        self.client.force_authenticate(self.staff)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 403)

    def test_admin_can_view_but_cannot_run_validation(self):
        self.client.force_authenticate(self.admin_user)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["mode"], "live")

        response = self.client.post(self.url, {"action": "validate"}, format="json")
        self.assertEqual(response.status_code, 403)

    def test_super_admin_validation_is_audited(self):
        self.client.force_authenticate(self.super_admin)
        response = self.client.post(self.url, {"action": "validate"}, format="json")
        self.assertEqual(response.status_code, 200)
        operation = AnalyticsOperation.objects.get(operation="validation")
        self.assertEqual(operation.initiated_by, self.super_admin)
        self.assertEqual(response.data["operations"][0]["type"], "Validation")
