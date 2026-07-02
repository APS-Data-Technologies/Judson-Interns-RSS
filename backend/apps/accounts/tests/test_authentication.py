from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.sites.models import Location


class AccountApiTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.location = Location.objects.create(
            location_name="Downtown",
            address="100 Main Street",
            city="Chicago",
            state="IL",
            zip_code="60601",
        )
        cls.staff = cls.create_user(
            email="staff@example.com",
            password="StrongPass123!",
            role=User.Role.STAFF,
            location=cls.location,
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

    def test_login_returns_token_and_safe_user_data(self):
        response = self.client.post(
            reverse("auth-login"),
            {"email": self.staff.email, "password": "StrongPass123!"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("token", response.data)
        self.assertEqual(response.data["user"]["email"], self.staff.email)
        self.assertEqual(response.data["user"]["location_name"], self.location.location_name)
        self.assertNotIn("password", response.data["user"])

    def test_all_three_roles_can_login(self):
        for user in (self.staff, self.admin, self.super_admin):
            with self.subTest(role=user.role):
                response = self.client.post(
                    reverse("auth-login"),
                    {"email": user.email, "password": "StrongPass123!"},
                    format="json",
                )
                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertEqual(response.data["user"]["role"], user.role)

    def test_login_updates_last_login(self):
        self.assertIsNone(self.staff.last_login)
        self.client.post(
            reverse("auth-login"),
            {"email": self.staff.email, "password": "StrongPass123!"},
            format="json",
        )
        self.staff.refresh_from_db()
        self.assertIsNotNone(self.staff.last_login)

    def test_user_manager_creates_email_based_super_admin(self):
        user = User.objects.create_superuser(
            email="command.superadmin@example.com",
            password="StrongPass123!",
            first_name="Command",
            last_name="Admin",
        )

        self.assertEqual(user.role, User.Role.SUPER_ADMIN)
        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_superuser)
        self.assertTrue(user.check_password("StrongPass123!"))

    def test_login_rejects_invalid_credentials(self):
        response = self.client.post(
            reverse("auth-login"),
            {"email": self.staff.email, "password": "incorrect"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(str(response.data["non_field_errors"][0]), "Invalid email or password.")

    def test_login_rejects_inactive_user(self):
        self.staff.is_active = False
        self.staff.save(update_fields=["is_active"])
        response = self.client.post(
            reverse("auth-login"),
            {"email": self.staff.email, "password": "StrongPass123!"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_current_user_requires_authentication(self):
        response = self.client.get(reverse("auth-me"))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_current_user_returns_authenticated_user(self):
        self.authenticate(self.staff)
        response = self.client.get(reverse("auth-me"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], self.staff.id)
        self.assertEqual(response.data["role"], User.Role.STAFF)

    def test_expired_token_is_rejected_and_deleted(self):
        token = self.authenticate(self.staff)
        Token.objects.filter(key=token.key).update(created=timezone.now() - timedelta(hours=13))

        response = self.client.get(reverse("auth-me"))

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertFalse(Token.objects.filter(key=token.key).exists())

    def test_logout_invalidates_token(self):
        token = self.authenticate(self.staff)
        response = self.client.post(reverse("auth-logout"))

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Token.objects.filter(key=token.key).exists())
        response = self.client.get(reverse("auth-me"))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_admin_cannot_manage_users(self):
        self.authenticate(self.admin)
        response = self.client.get(reverse("user-list"))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_cannot_list_user_assignment_locations(self):
        self.authenticate(self.admin)
        response = self.client.get(reverse("user-location-list"))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_staff_cannot_manage_users(self):
        self.authenticate(self.staff)
        response = self.client.get(reverse("user-list"))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_super_admin_can_list_users_and_active_locations(self):
        self.authenticate(self.super_admin)

        users_response = self.client.get(reverse("user-list"))
        locations_response = self.client.get(reverse("user-location-list"))

        self.assertEqual(users_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(users_response.data), 3)
        self.assertEqual(locations_response.status_code, status.HTTP_200_OK)
        self.assertEqual(locations_response.data[0]["location_name"], self.location.location_name)

    def test_super_admin_can_create_staff_user_with_hashed_password(self):
        self.authenticate(self.super_admin)
        response = self.client.post(
            reverse("user-list"),
            {
                "email": "new.staff@example.com",
                "first_name": "New",
                "last_name": "Staff",
                "role": User.Role.STAFF,
                "location": self.location.id,
                "password": "AnotherStrong123!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(email="new.staff@example.com")
        self.assertNotEqual(user.password, "AnotherStrong123!")
        self.assertTrue(user.check_password("AnotherStrong123!"))

    def test_super_admin_role_sets_django_admin_flags(self):
        self.authenticate(self.super_admin)
        response = self.client.post(
            reverse("user-list"),
            {
                "email": "new.super@example.com",
                "first_name": "New",
                "last_name": "Super",
                "role": User.Role.SUPER_ADMIN,
                "password": "AnotherStrong123!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(email="new.super@example.com")
        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_superuser)

    def test_admin_cannot_be_assigned_to_location(self):
        self.authenticate(self.super_admin)
        response = self.client.post(
            reverse("user-list"),
            {
                "email": "located.admin@example.com",
                "first_name": "Located",
                "last_name": "Admin",
                "role": User.Role.ADMIN,
                "location": self.location.id,
                "password": "AnotherStrong123!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("location", response.data)

    def test_staff_user_requires_location(self):
        self.authenticate(self.super_admin)
        response = self.client.post(
            reverse("user-list"),
            {
                "email": "unassigned@example.com",
                "first_name": "Unassigned",
                "last_name": "Staff",
                "role": User.Role.STAFF,
                "password": "AnotherStrong123!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("location", response.data)

    def test_user_creation_applies_password_validation(self):
        self.authenticate(self.super_admin)
        response = self.client.post(
            reverse("user-list"),
            {
                "email": "weak.password@example.com",
                "first_name": "Weak",
                "last_name": "Password",
                "role": User.Role.ADMIN,
                "password": "123",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", response.data)

    def test_user_email_is_normalized(self):
        user = self.create_user(
            email="Mixed.Case@Example.COM",
            password="StrongPass123!",
            role=User.Role.ADMIN,
        )
        self.assertEqual(user.email, "mixed.case@example.com")

    def test_user_creation_rejects_case_variant_duplicate_email(self):
        self.authenticate(self.super_admin)
        response = self.client.post(
            reverse("user-list"),
            {
                "email": "STAFF@EXAMPLE.COM",
                "first_name": "Duplicate",
                "last_name": "User",
                "role": User.Role.STAFF,
                "location": self.location.id,
                "password": "AnotherStrong123!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data)

    def test_deleting_user_deactivates_account_and_token(self):
        self.authenticate(self.super_admin)
        staff_token = Token.objects.create(user=self.staff)
        response = self.client.delete(reverse("user-detail", args=[self.staff.id]))

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.staff.refresh_from_db()
        self.assertFalse(self.staff.is_active)
        self.assertFalse(Token.objects.filter(key=staff_token.key).exists())

    def test_self_service_password_change_rotates_token(self):
        old_token = self.authenticate(self.staff)
        response = self.client.post(
            reverse("auth-change-password"),
            {
                "current_password": "StrongPass123!",
                "new_password": "ChangedPass456!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotEqual(response.data["token"], old_token.key)
        self.assertFalse(Token.objects.filter(key=old_token.key).exists())
        self.staff.refresh_from_db()
        self.assertTrue(self.staff.check_password("ChangedPass456!"))

    def test_password_change_rejects_incorrect_current_password(self):
        self.authenticate(self.staff)
        response = self.client.post(
            reverse("auth-change-password"),
            {
                "current_password": "incorrect",
                "new_password": "ChangedPass456!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("current_password", response.data)

    def test_super_admin_password_reset_invalidates_user_token(self):
        self.authenticate(self.super_admin)
        staff_token = Token.objects.create(user=self.staff)
        response = self.client.patch(
            reverse("user-detail", args=[self.staff.id]),
            {"password": "ResetPass789!"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(Token.objects.filter(key=staff_token.key).exists())
        self.staff.refresh_from_db()
        self.assertTrue(self.staff.check_password("ResetPass789!"))

    def test_super_admin_cannot_deactivate_own_account(self):
        self.authenticate(self.super_admin)
        response = self.client.delete(reverse("user-detail", args=[self.super_admin.id]))

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.super_admin.refresh_from_db()
        self.assertTrue(self.super_admin.is_active)

    def test_super_admin_cannot_patch_own_role_or_active_status(self):
        self.authenticate(self.super_admin)

        role_response = self.client.patch(
            reverse("user-detail", args=[self.super_admin.id]),
            {"role": User.Role.ADMIN},
            format="json",
        )
        active_response = self.client.patch(
            reverse("user-detail", args=[self.super_admin.id]),
            {"is_active": False},
            format="json",
        )

        self.assertEqual(role_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(active_response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_super_admin_must_use_self_service_password_change(self):
        self.authenticate(self.super_admin)
        response = self.client.patch(
            reverse("user-detail", args=[self.super_admin.id]),
            {"password": "ResetPass789!"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", response.data)
