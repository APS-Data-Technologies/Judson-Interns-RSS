from django.db import models


class LeadSource(models.Model):
    source_name = models.CharField(max_length=150, unique=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["source_name"]
        indexes = [
            models.Index(fields=["is_active"]),
        ]

    def __str__(self):
        return self.source_name


class Family(models.Model):
    family_name = models.CharField(max_length=150)
    contact_email = models.EmailField(blank=True)
    contact_phone = models.CharField(max_length=20, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "families"
        ordering = ["family_name"]
        indexes = [
            models.Index(fields=["family_name"]),
            models.Index(fields=["contact_email"]),
        ]

    def __str__(self):
        return self.family_name

