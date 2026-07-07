from django.db import models


class Location(models.Model):
    external_id = models.CharField(max_length=40, unique=True, null=True, blank=True)
    location_name = models.CharField(max_length=150, unique=True)
    address = models.CharField(max_length=255)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=2)
    zip_code = models.CharField(max_length=10)
    phone = models.CharField(max_length=20, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["location_name"]
        indexes = [
            models.Index(fields=["is_active"]),
            models.Index(fields=["city", "state"]),
        ]

    def __str__(self):
        return self.location_name
