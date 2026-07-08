from django.urls import reverse
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.sites.models import Location


class LocationApiTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.location_one = Location.objects.create(
            external_id="loc-001",
            location_name="Downtown",
            address="100 Main Street",
            city="Chicago",
            state="IL",
            zip_code="60601",
            phone="3125550101",
        )
        cls.location_two = Location.objects.create(
            external_id="loc-002",
            location_name="North Campus",
            address="200 Lake Shore Drive",
            city="Chicago",
            state="IL",
            zip_code="60611",
            phone="3125550199",
            is_active=False,
        )
        cls.staff = cls.create_user(
            email="staff@example.com",
            password="StrongPass123!",
            role=User.Role.STAFF,
            location=cls.location_one,
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
    def create_user(email, password, role, location=None):
        user = User(
            email=email,
            first_name="Test",
            last_name="User",
            role=role,
            location=location,
        )
        user.set_password(password)
        user.save()
        return user

    def authenticate(self, user):
        token = Token.objects.create(user=user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
        return token

    def test_location_list_requires_authentication(self):
        response = self.client.get(reverse("location-list"))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_staff_only_sees_assigned_location(self):
        self.authenticate(self.staff)
        response = self.client.get(reverse("location-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["id"], self.location_one.id)

    def test_admin_only_sees_active_locations(self):
        self.authenticate(self.admin)
        response = self.client.get(reverse("location-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["id"], self.location_one.id)

    def test_super_admin_sees_active_and_inactive_locations(self):
        self.authenticate(self.super_admin)
        response = self.client.get(reverse("location-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_admin_can_retrieve_inactive_location_for_management(self):
        self.authenticate(self.admin)
        response = self.client.get(reverse("location-detail", args=[self.location_two.id]))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], self.location_two.id)

    def test_staff_can_retrieve_assigned_location(self):
        self.authenticate(self.staff)
        response = self.client.get(reverse("location-detail", args=[self.location_one.id]))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["location_name"], self.location_one.location_name)

    def test_staff_cannot_retrieve_other_location(self):
        self.authenticate(self.staff)
        response = self.client.get(reverse("location-detail", args=[self.location_two.id]))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_staff_cannot_create_location(self):
        self.authenticate(self.staff)
        response = self.client.post(
            reverse("location-list"),
            {
                "location_name": "West Campus",
                "address": "300 Oak Street",
                "city": "Chicago",
                "state": "IL",
                "zip_code": "60622",
                "phone": "3125550110",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_create_location(self):
        self.authenticate(self.admin)
        response = self.client.post(
            reverse("location-list"),
            {
                "external_id": "loc-003",
                "location_name": "West Campus",
                "address": "300 Oak Street",
                "city": "Chicago",
                "state": "il",
                "zip_code": "60622",
                "phone": "3125550110",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["location_name"], "West Campus")
        self.assertEqual(response.data["state"], "IL")

    def test_super_admin_can_update_location(self):
        self.authenticate(self.super_admin)
        response = self.client.patch(
            reverse("location-detail", args=[self.location_one.id]),
            {
                "city": "Evanston",
                "phone": "8475550101",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.location_one.refresh_from_db()
        self.assertEqual(self.location_one.city, "Evanston")
        self.assertEqual(self.location_one.phone, "8475550101")

    def test_admin_can_reactivate_inactive_location(self):
        self.authenticate(self.admin)
        response = self.client.patch(
            reverse("location-detail", args=[self.location_two.id]),
            {"is_active": True},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.location_two.refresh_from_db()
        self.assertTrue(self.location_two.is_active)

    def test_duplicate_location_name_is_rejected_case_insensitively(self):
        self.authenticate(self.super_admin)
        response = self.client.post(
            reverse("location-list"),
            {
                "location_name": "downtown",
                "address": "500 State Street",
                "city": "Chicago",
                "state": "IL",
                "zip_code": "60654",
                "phone": "3125550103",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("location_name", response.data)

    def test_invalid_state_is_rejected(self):
        self.authenticate(self.super_admin)
        response = self.client.post(
            reverse("location-list"),
            {
                "location_name": "South Campus",
                "address": "500 State Street",
                "city": "Chicago",
                "state": "Illinois",
                "zip_code": "60654",
                "phone": "3125550103",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("state", response.data)
