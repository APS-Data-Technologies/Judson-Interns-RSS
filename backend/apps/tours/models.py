from django.conf import settings
from django.db import models


class TourStatus(models.TextChoices):
    SCHEDULED = "scheduled", "Scheduled"
    RESCHEDULED = "rescheduled", "Rescheduled"
    TOURED = "toured", "Toured"
    ENROLLED = "enrolled", "Enrolled"
    CHURNED = "churned", "Churned"
    CANCELLED = "cancelled", "Cancelled"
    NO_SHOW = "no_show", "No Show"


class Tour(models.Model):
    external_id = models.CharField(max_length=40, unique=True, null=True, blank=True)
    family = models.ForeignKey("leads.Family", on_delete=models.PROTECT, related_name="tours")
    location = models.ForeignKey("sites.Location", on_delete=models.PROTECT, related_name="tours")
    lead_source = models.ForeignKey("leads.LeadSource", on_delete=models.PROTECT, related_name="tours")
    assigned_staff = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="assigned_tours",
    )
    child_grade = models.CharField(max_length=50, blank=True)
    scheduled_tour_date = models.DateTimeField()
    current_status = models.CharField(
        max_length=20,
        choices=TourStatus.choices,
        default=TourStatus.SCHEDULED,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-scheduled_tour_date", "-created_at"]
        indexes = [
            models.Index(fields=["current_status"]),
            models.Index(fields=["scheduled_tour_date"]),
            models.Index(fields=["location", "current_status"]),
            models.Index(fields=["lead_source"]),
            models.Index(fields=["assigned_staff"]),
        ]

    def __str__(self):
        return f"{self.family} - {self.get_current_status_display()}"


class TourEvent(models.Model):
    external_id = models.CharField(max_length=40, unique=True, null=True, blank=True)
    tour = models.ForeignKey(Tour, on_delete=models.CASCADE, related_name="events")
    status = models.CharField(max_length=20, choices=TourStatus.choices)
    event_timestamp = models.DateTimeField()
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="tour_events_updated",
    )
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-event_timestamp", "-id"]
        indexes = [
            models.Index(fields=["tour", "event_timestamp"]),
            models.Index(fields=["status"]),
            models.Index(fields=["updated_by"]),
        ]

    def __str__(self):
        return f"{self.tour_id} - {self.get_status_display()} at {self.event_timestamp:%Y-%m-%d %H:%M}"
