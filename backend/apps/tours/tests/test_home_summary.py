from datetime import date, datetime, time, timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.leads.models import Family, LeadSource
from apps.sites.models import Location
from apps.tours.models import Tour, TourStatus


class HomeSummaryApiTests(APITestCase):
    summary_date = date(2026, 7, 7)

    @classmethod
    def setUpTestData(cls):
        cls.downtown = cls.create_location("Downtown")
        cls.uptown = cls.create_location("Uptown")
        cls.source = LeadSource.objects.create(source_name="Website")
        cls.referral = LeadSource.objects.create(source_name="Referral")
        cls.staff = cls.create_user("staff@example.com", User.Role.STAFF, cls.downtown)
        cls.unassigned_staff = cls.create_user("unassigned@example.com", User.Role.STAFF)
        cls.admin = cls.create_user("admin@example.com", User.Role.ADMIN)
        cls.super_admin = cls.create_user("super@example.com", User.Role.SUPER_ADMIN)

        cls.create_tour(
            family_name="Downtown Family",
            location=cls.downtown,
            source=cls.source,
            assigned_staff=cls.staff,
            scheduled_date=cls.summary_date,
            tour_status=TourStatus.SCHEDULED,
        )
        cls.create_tour(
            family_name="Uptown Family",
            location=cls.uptown,
            source=cls.referral,
            assigned_staff=cls.admin,
            scheduled_date=cls.summary_date,
            tour_status=TourStatus.SCHEDULED,
        )
        cls.create_tour(
            family_name="Yesterday No Show",
            location=cls.downtown,
            source=cls.source,
            assigned_staff=cls.staff,
            scheduled_date=cls.summary_date - timedelta(days=1),
            tour_status=TourStatus.NO_SHOW,
        )

    @staticmethod
    def create_location(name):
        return Location.objects.create(
            location_name=name,
            address="100 Main Street",
            city="Chicago",
            state="IL",
            zip_code="60601",
        )

    @staticmethod
    def create_user(email, role, location=None):
        return User.objects.create_user(
            email=email,
            password="StrongPass123!",
            first_name="Test",
            last_name="User",
            role=role,
            location=location,
        )

    @classmethod
    def create_tour(
        cls,
        *,
        family_name,
        location,
        source,
        assigned_staff,
        scheduled_date,
        tour_status,
    ):
        family = Family.objects.create(family_name=family_name)
        scheduled_at = timezone.make_aware(datetime.combine(scheduled_date, time(12)))
        return Tour.objects.create(
            family=family,
            location=location,
            lead_source=source,
            assigned_staff=assigned_staff,
            scheduled_tour_date=scheduled_at,
            current_status=tour_status,
        )

    def get_summary(self, user=None, **params):
        self.client.force_authenticate(user=user)
        return self.client.get(reverse("home-summary"), params)

    def test_authentication_is_required(self):
        response = self.get_summary(date=self.summary_date.isoformat())

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_staff_only_sees_tours_and_filters_for_assigned_location(self):
        response = self.get_summary(self.staff, date=self.summary_date.isoformat())

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [tour["family_name"] for tour in response.data["booked_tours"]],
            ["Downtown Family"],
        )
        self.assertEqual(
            response.data["filters"]["locations"],
            [{"id": self.downtown.id, "location_name": "Downtown"}],
        )

    def test_staff_cannot_request_another_location(self):
        response = self.get_summary(
            self.staff,
            date=self.summary_date.isoformat(),
            location=self.uptown.id,
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("location", response.data)

    def test_unassigned_staff_receives_no_location_data(self):
        response = self.get_summary(
            self.unassigned_staff,
            date=self.summary_date.isoformat(),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["booked_tours"], [])
        self.assertEqual(response.data["filters"]["locations"], [])

    def test_admin_and_super_admin_can_see_all_locations(self):
        for user in (self.admin, self.super_admin):
            with self.subTest(role=user.role):
                response = self.get_summary(user, date=self.summary_date.isoformat())

                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertEqual(len(response.data["booked_tours"]), 2)
                self.assertEqual(len(response.data["filters"]["locations"]), 2)

    def test_summary_returns_bookings_and_previous_day_no_shows(self):
        response = self.get_summary(self.admin, date=self.summary_date.isoformat())

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["booked_tours"]), 2)
        self.assertEqual(
            [tour["family_name"] for tour in response.data["no_show_tours"]],
            ["Yesterday No Show"],
        )

    def test_missing_date_uses_the_django_local_date(self):
        self.create_tour(
            family_name="Current Local Date",
            location=self.downtown,
            source=self.source,
            assigned_staff=self.staff,
            scheduled_date=timezone.localdate(),
            tour_status=TourStatus.SCHEDULED,
        )

        response = self.get_summary(self.admin)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["date"], timezone.localdate())
        self.assertIn(
            "Current Local Date",
            [tour["family_name"] for tour in response.data["booked_tours"]],
        )

    def test_invalid_date_returns_bad_request(self):
        response = self.get_summary(self.admin, date="not-a-date")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("date", response.data)

    def test_lead_source_and_search_filters_are_applied(self):
        response = self.get_summary(
            self.admin,
            date=self.summary_date.isoformat(),
            lead_source=self.source.id,
            search="Downtown",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [tour["family_name"] for tour in response.data["booked_tours"]],
            ["Downtown Family"],
        )
