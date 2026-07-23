from django.conf import settings
from django.db import models


class AnalyticsOperation(models.Model):
    class Operation(models.TextChoices):
        VALIDATION = "validation", "Validation"
        EXPORT = "export", "Export"

    operation = models.CharField(max_length=20, choices=Operation.choices)
    status = models.CharField(max_length=20, default="completed")
    detail = models.CharField(max_length=255, blank=True)
    initiated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="analytics_operations",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["operation", "created_at"])]

