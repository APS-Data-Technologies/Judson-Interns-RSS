from django.db import models


class CostBasis(models.Model):
    class CostType(models.TextChoices):
        EXPENDITURE = "Expenditure", "Expenditure"
        REVENUE = "Revenue", "Revenue"

    external_id = models.CharField(max_length=40, unique=True, null=True, blank=True)
    location = models.ForeignKey("sites.Location", on_delete=models.PROTECT, related_name="cost_basis_entries")
    reporting_month = models.DateField()
    cost_type = models.CharField(max_length=100, choices=CostType.choices)
    cost_amount = models.DecimalField(max_digits=12, decimal_places=2)
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "cost basis entries"
        ordering = ["-reporting_month", "location", "cost_type"]
        constraints = [
            models.UniqueConstraint(
                fields=["location", "reporting_month", "cost_type"],
                name="unique_cost_basis_location_month_type",
            ),
            models.CheckConstraint(
                condition=models.Q(cost_amount__gte=0),
                name="cost_basis_amount_non_negative",
            ),
        ]
        indexes = [
            models.Index(fields=["location", "reporting_month"]),
            models.Index(fields=["cost_type"]),
        ]

    def __str__(self):
        return f"{self.location} - {self.cost_type} - {self.reporting_month:%Y-%m}"
