from django.contrib import admin

from .models import Location


@admin.register(Location)
class LocationAdmin(admin.ModelAdmin):
    list_display = ("location_name", "city", "state", "phone", "is_active")
    list_filter = ("is_active", "state")
    search_fields = ("location_name", "address", "city", "phone")

