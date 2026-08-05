from datetime import timedelta
from unittest.mock import patch

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.leads.models import Family, LeadSource
from apps.sites.models import Location
from apps.tours.models import Tour, TourEvent, TourStatus


class TourWorkflowApiTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.downtown = cls.create_location("Downtown")
        cls.uptown = cls.create_location("Uptown")
        cls.source = LeadSource.objects.create(source_name="Website")
        cls.referral = LeadSource.objects.create(source_name="Referral")
        cls.staff = cls.create_user("staff@example.com", User.Role.STAFF, cls.downtown)
        cls.uptown_staff = cls.create_user(
            "uptown@example.com", User.Role.STAFF, cls.uptown
        )
        cls.admin = cls.create_user("admin@example.com", User.Role.ADMIN)
        cls.super_admin = cls.create_user("super@example.com", User.Role.SUPER_ADMIN)
        cls.downtown_tour = cls.create_tour(
            "Downtown Family", cls.downtown, cls.source, cls.staff
        )
        cls.uptown_tour = cls.create_tour(
            "Uptown Family", cls.uptown, cls.referral, cls.uptown_staff
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

    @staticmethod
    def create_tour(family_name, location, source, assigned_staff, **overrides):
        values = {
            "family": Family.objects.create(family_name=family_name),
            "location": location,
            "lead_source": source,
            "assigned_staff": assigned_staff,
            "scheduled_tour_date": timezone.now() + timedelta(days=2),
            "current_status": TourStatus.SCHEDULED,
        }
        values.update(overrides)
        return Tour.objects.create(**values)

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def test_authentication_is_required(self):
        response = self.client.get(reverse("tour-list"))

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_staff_list_and_detail_are_limited_to_assigned_location(self):
        self.authenticate(self.staff)

        list_response = self.client.get(reverse("tour-list"))
        own_response = self.client.get(
            reverse("tour-detail", args=[self.downtown_tour.id])
        )
        other_response = self.client.get(
            reverse("tour-detail", args=[self.uptown_tour.id])
        )

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual([tour["id"] for tour in list_response.data], [self.downtown_tour.id])
        self.assertEqual(own_response.status_code, status.HTTP_200_OK)
        self.assertEqual(other_response.status_code, status.HTTP_404_NOT_FOUND)

    def test_admin_and_super_admin_can_access_all_tours(self):
        for user in (self.admin, self.super_admin):
            with self.subTest(role=user.role):
                self.authenticate(user)
                response = self.client.get(reverse("tour-list"))

                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertEqual(len(response.data), 2)

    def test_staff_cannot_create_tour_for_another_location(self):
        self.authenticate(self.staff)
        response = self.client.post(
            reverse("tour-list"),
            {
                "family_name": "Blocked Family",
                "location": self.uptown.id,
                "lead_source": self.source.id,
                "scheduled_tour_date": (timezone.now() + timedelta(days=3)).isoformat(),
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("location", response.data)
        self.assertFalse(Family.objects.filter(family_name="Blocked Family").exists())

    def test_create_tour_also_creates_initial_event(self):
        self.authenticate(self.staff)
        response = self.client.post(
            reverse("tour-list"),
            {
                "family_name": "New Family",
                "student_name": "Alex",
                "location": self.downtown.id,
                "lead_source": self.source.id,
                "scheduled_tour_date": (timezone.now() + timedelta(days=3)).isoformat(),
                "notes": "Initial booking",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        tour = Tour.objects.get(pk=response.data["id"])
        event = tour.events.get()
        self.assertEqual(tour.assigned_staff, self.staff)
        self.assertEqual(tour.student_name, "Alex")
        self.assertEqual(tour.family.notes, "Initial booking")
        self.assertEqual(response.data["student_name"], "Alex")
        self.assertEqual(event.status, TourStatus.SCHEDULED)
        self.assertEqual(event.updated_by, self.staff)

    def test_create_tour_accepts_exactly_ten_phone_digits(self):
        self.authenticate(self.staff)
        response = self.client.post(
            reverse("tour-list"),
            {
                "family_name": "Ten Digit Phone",
                "contact_phone": "3125550199",
                "location": self.downtown.id,
                "lead_source": self.source.id,
                "scheduled_tour_date": (timezone.now() + timedelta(days=3)).isoformat(),
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["contact_phone"], "3125550199")

    def test_create_tour_rejects_phone_that_is_not_ten_digits(self):
        self.authenticate(self.staff)
        for phone in ("312555019", "312-555-0199", "31255501999"):
            with self.subTest(phone=phone):
                response = self.client.post(
                    reverse("tour-list"),
                    {
                        "family_name": f"Invalid Phone {phone}",
                        "contact_phone": phone,
                        "location": self.downtown.id,
                        "lead_source": self.source.id,
                        "scheduled_tour_date": (timezone.now() + timedelta(days=3)).isoformat(),
                    },
                    format="json",
                )

                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertEqual(
                    str(response.data["contact_phone"][0]),
                    "Phone must contain exactly 10 digits.",
                )

    def test_student_name_is_optional(self):
        self.authenticate(self.staff)
        response = self.client.post(
            reverse("tour-list"),
            {
                "family_name": "No Student Name",
                "location": self.downtown.id,
                "lead_source": self.source.id,
                "scheduled_tour_date": (timezone.now() + timedelta(days=3)).isoformat(),
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["student_name"], "")

    def test_student_name_can_be_updated_on_a_tour(self):
        self.authenticate(self.staff)
        response = self.client.patch(
            reverse("tour-detail", args=[self.downtown_tour.id]),
            {"student_name": "Jordan"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.downtown_tour.refresh_from_db()
        self.assertEqual(self.downtown_tour.student_name, "Jordan")
        self.assertEqual(response.data["student_name"], "Jordan")

    def test_same_family_name_requires_an_explicit_resolution(self):
        self.authenticate(self.staff)
        response = self.client.post(
            reverse("tour-list"),
            {
                "family_name": "Downtown Family",
                "location": self.downtown.id,
                "lead_source": self.source.id,
                "scheduled_tour_date": (timezone.now() + timedelta(days=3)).isoformat(),
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["family_matches"][0]["id"], str(self.downtown_tour.family_id))
        self.assertEqual(Tour.objects.filter(family=self.downtown_tour.family).count(), 1)

    def test_existing_family_can_be_reused_without_overwriting_contact_details(self):
        family = self.downtown_tour.family
        family.contact_email = "original@example.com"
        family.contact_phone = "6305550100"
        family.save(update_fields=["contact_email", "contact_phone"])
        self.authenticate(self.staff)

        response = self.client.post(
            reverse("tour-list"),
            {
                "family_name": family.family_name,
                "existing_family": family.id,
                "contact_email": "replacement@example.com",
                "contact_phone": "6305559999",
                "location": self.downtown.id,
                "lead_source": self.source.id,
                "scheduled_tour_date": (timezone.now() + timedelta(days=3)).isoformat(),
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        family.refresh_from_db()
        self.assertEqual(family.contact_email, "original@example.com")
        self.assertEqual(family.contact_phone, "6305550100")
        self.assertEqual(Tour.objects.filter(family=family).count(), 2)

    def test_same_family_name_can_create_a_separate_family(self):
        self.authenticate(self.staff)
        response = self.client.post(
            reverse("tour-list"),
            {
                "family_name": "Downtown Family",
                "create_new_family": True,
                "contact_email": "different@example.com",
                "location": self.downtown.id,
                "lead_source": self.source.id,
                "scheduled_tour_date": (timezone.now() + timedelta(days=3)).isoformat(),
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Family.objects.filter(family_name="Downtown Family").count(), 2)
        self.assertNotEqual(response.data["family"], self.downtown_tour.family_id)

    def test_normal_patch_rejects_status_and_schedule_changes(self):
        self.authenticate(self.admin)
        original_date = self.downtown_tour.scheduled_tour_date
        response = self.client.patch(
            reverse("tour-detail", args=[self.downtown_tour.id]),
            {
                "current_status": TourStatus.TOURED,
                "scheduled_tour_date": (timezone.now() + timedelta(days=5)).isoformat(),
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.downtown_tour.refresh_from_db()
        self.assertEqual(self.downtown_tour.current_status, TourStatus.SCHEDULED)
        self.assertEqual(self.downtown_tour.scheduled_tour_date, original_date)
        self.assertEqual(self.downtown_tour.events.count(), 0)

    def test_valid_status_transition_updates_tour_and_appends_event(self):
        self.authenticate(self.staff)
        response = self.client.post(
            reverse("tour-transition-status", args=[self.downtown_tour.id]),
            {"status": TourStatus.TOURED, "notes": "Tour completed"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.downtown_tour.refresh_from_db()
        event = self.downtown_tour.events.get()
        self.assertEqual(self.downtown_tour.current_status, TourStatus.TOURED)
        self.assertEqual(event.status, TourStatus.TOURED)
        self.assertEqual(event.updated_by, self.staff)
        self.assertEqual(event.notes, "Tour completed")

    def test_invalid_status_transition_does_not_create_event(self):
        self.authenticate(self.admin)
        response = self.client.post(
            reverse("tour-transition-status", args=[self.downtown_tour.id]),
            {"status": TourStatus.ENROLLED},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.downtown_tour.refresh_from_db()
        self.assertEqual(self.downtown_tour.current_status, TourStatus.SCHEDULED)
        self.assertEqual(self.downtown_tour.events.count(), 0)

    def test_rescheduled_status_requires_reschedule_endpoint(self):
        self.authenticate(self.admin)
        response = self.client.post(
            reverse("tour-transition-status", args=[self.downtown_tour.id]),
            {"status": "rescheduled"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("status", response.data)

    def test_reschedule_updates_date_status_and_history_atomically(self):
        self.authenticate(self.staff)
        new_date = timezone.now() + timedelta(days=7)
        response = self.client.post(
            reverse("tour-reschedule", args=[self.downtown_tour.id]),
            {"scheduled_tour_date": new_date.isoformat(), "notes": "Family request"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.downtown_tour.refresh_from_db()
        event = self.downtown_tour.events.get()
        self.assertEqual(self.downtown_tour.current_status, TourStatus.SCHEDULED)
        self.assertEqual(self.downtown_tour.scheduled_tour_date, new_date)
        self.assertEqual(event.status, "rescheduled")
        self.assertEqual(event.notes, "Family request")

    def test_cancel_moves_tour_to_no_show_with_operational_details(self):
        self.authenticate(self.staff)
        response = self.client.post(
            reverse("tour-cancel", args=[self.downtown_tour.id]),
            {"reason": "Family is no longer available."},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.downtown_tour.refresh_from_db()
        self.assertEqual(self.downtown_tour.current_status, TourStatus.NO_SHOW)
        self.assertIsNotNone(self.downtown_tour.cancelled_at)
        self.assertEqual(self.downtown_tour.cancellation_reason, "Family is no longer available.")
        self.assertEqual(response.data["operational_status"], "cancelled")
        event = self.downtown_tour.events.get()
        self.assertEqual(event.status, "cancelled")

    def test_terminal_tour_cannot_be_rescheduled(self):
        self.downtown_tour.current_status = TourStatus.NO_SHOW
        self.downtown_tour.save(update_fields=["current_status", "updated_at"])
        self.authenticate(self.admin)
        response = self.client.post(
            reverse("tour-reschedule", args=[self.downtown_tour.id]),
            {"scheduled_tour_date": (timezone.now() + timedelta(days=7)).isoformat()},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.downtown_tour.events.count(), 0)

    def test_event_history_is_newest_first(self):
        older_event = TourEvent.objects.create(
            tour=self.downtown_tour,
            status=TourStatus.SCHEDULED,
            event_timestamp=timezone.now() - timedelta(hours=1),
            updated_by=self.staff,
        )
        newer_event = TourEvent.objects.create(
            tour=self.downtown_tour,
            status=TourStatus.TOURED,
            event_timestamp=timezone.now(),
            updated_by=self.admin,
        )
        self.authenticate(self.staff)
        response = self.client.get(
            reverse("tour-events", args=[self.downtown_tour.id])
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [event["id"] for event in response.data],
            [newer_event.id, older_event.id],
        )
        self.assertEqual(response.data[0]["updated_by_name"], "Test User")

    def test_staff_cannot_access_other_location_workflow(self):
        self.authenticate(self.staff)
        response = self.client.post(
            reverse("tour-transition-status", args=[self.uptown_tour.id]),
            {"status": TourStatus.TOURED},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.uptown_tour.refresh_from_db()
        self.assertEqual(self.uptown_tour.current_status, TourStatus.SCHEDULED)

    def test_tours_cannot_be_deleted_through_api(self):
        self.authenticate(self.super_admin)
        response = self.client.delete(
            reverse("tour-detail", args=[self.downtown_tour.id])
        )

        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertTrue(Tour.objects.filter(pk=self.downtown_tour.id).exists())

    def test_event_failure_rolls_back_status_change(self):
        self.authenticate(self.admin)

        with patch(
            "apps.tours.views.TourEvent.objects.create",
            side_effect=RuntimeError("event write failed"),
        ):
            with self.assertRaises(RuntimeError):
                self.client.post(
                    reverse("tour-transition-status", args=[self.downtown_tour.id]),
                    {"status": TourStatus.TOURED},
                    format="json",
                )

        self.downtown_tour.refresh_from_db()
        self.assertEqual(self.downtown_tour.current_status, TourStatus.SCHEDULED)
        self.assertEqual(self.downtown_tour.events.count(), 0)
