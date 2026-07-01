from django.contrib import admin

from .models import CostBasis


@admin.register(CostBasis)
class CostBasisAdmin(admin.ModelAdmin):
    list_display = ("location", "reporting_month", "cost_type", "cost_amount")
    list_filter = ("location", "cost_type", "reporting_month")
    search_fields = ("location__location_name", "cost_type", "notes")
    date_hierarchy = "reporting_month"

