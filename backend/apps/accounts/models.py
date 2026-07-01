from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        SUPER_ADMIN = "super_admin", "Super Admin"
        ADMIN = "admin", "Admin"
        STAFF = "staff", "Staff"

    username = None
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.STAFF)
    location = models.ForeignKey(
        "sites.Location",
        on_delete=models.PROTECT,
        related_name="users",
        null=True,
        blank=True,
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["first_name", "last_name"]

    class Meta:
        ordering = ["last_name", "first_name", "email"]
        indexes = [
            models.Index(fields=["role"]),
            models.Index(fields=["is_active"]),
        ]

    def __str__(self):
        return self.get_full_name() or self.email

