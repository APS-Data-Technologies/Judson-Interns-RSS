from datetime import time

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import User
from apps.leads.models import Family, LeadSource
from apps.sites.models import Location
from apps.tours.models import Tour, TourEvent, TourStatus


class Command(BaseCommand):
    help = "Seed current-date demo tours for local development and demos."

    def add_arguments(self, parser):
        parser.add_argument(
            "--date",
            help="Base date in YYYY-MM-DD format. Defaults to today's local date.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        base_date = self._parse_base_date(options.get("date"))
        yesterday = base_date - timezone.timedelta(days=1)

        staff_user = self._get_staff_user()
        locations = self._get_locations()
        lead_sources = self._get_lead_sources()

        booked_rows = [
            ("Johnson", "Maya Johnson", "9", time(9, 0), 0, 0),
            ("Garcia", "Mateo Garcia", "10", time(10, 30), 1, 1),
            ("Williams", "Ari Williams", "8", time(13, 0), 0, 2),
            ("Patel", "Nina Patel", "11", time(14, 30), 2, 0),
        ]
        no_show_rows = [
            ("Brown", "Eli Brown", "7", time(11, 0), 0, 1),
            ("Martinez", "Sofia Martinez", "9", time(15, 0), 1, 0),
        ]

        booked_count = self._seed_tours(
            rows=booked_rows,
            tour_date=base_date,
            status=TourStatus.SCHEDULED,
            staff_user=staff_user,
            locations=locations,
            lead_sources=lead_sources,
        )
        no_show_count = self._seed_tours(
            rows=no_show_rows,
            tour_date=yesterday,
            status=TourStatus.NO_SHOW,
            staff_user=staff_user,
            locations=locations,
            lead_sources=lead_sources,
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {booked_count} booked tours for {base_date} and "
                f"{no_show_count} no-show tours for {yesterday}."
            )
        )

    def _parse_base_date(self, date_value):
        if not date_value:
            return timezone.localdate()
        try:
            return timezone.datetime.fromisoformat(date_value).date()
        except ValueError as error:
            raise CommandError("--date must be in YYYY-MM-DD format.") from error

    def _get_staff_user(self):
        user = (
            User.objects.filter(is_active=True, role=User.Role.STAFF)
            .order_by("-password", "email")
            .first()
        )
        if user is None:
            raise CommandError("No active staff user exists for assigning demo tours.")
        return user

    def _get_locations(self):
        locations = list(Location.objects.filter(is_active=True).order_by("location_name"))
        if len(locations) < 3:
            raise CommandError("At least 3 active locations are required for demo tours.")
        return locations

    def _get_lead_sources(self):
        lead_sources = list(LeadSource.objects.filter(is_active=True).order_by("source_name"))
        if len(lead_sources) < 3:
            raise CommandError("At least 3 active lead sources are required for demo tours.")
        return lead_sources

    def _seed_tours(self, rows, tour_date, status, staff_user, locations, lead_sources):
        count = 0
        for family_name, student_name, grade, tour_time, location_index, source_index in rows:
            family, _ = Family.objects.update_or_create(
                family_name=family_name,
                defaults={
                    "contact_email": f"{family_name.lower()}.family@example.com",
                    "contact_phone": "210-555-0100",
                    "notes": f"Demo family for {student_name}.",
                },
            )
            scheduled_at = timezone.make_aware(
                timezone.datetime.combine(tour_date, tour_time),
                timezone.get_current_timezone(),
            )
            tour, _ = Tour.objects.update_or_create(
                family=family,
                scheduled_tour_date=scheduled_at,
                defaults={
                    "location": locations[location_index],
                    "lead_source": lead_sources[source_index],
                    "assigned_staff": staff_user,
                    "child_grade": grade,
                    "current_status": status,
                },
            )
            TourEvent.objects.update_or_create(
                tour=tour,
                status=status,
                defaults={
                    "event_timestamp": scheduled_at,
                    "updated_by": staff_user,
                    "notes": "Current demo dashboard seed data.",
                },
            )
            count += 1
        return count
