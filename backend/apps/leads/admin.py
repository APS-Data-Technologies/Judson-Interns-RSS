from django.contrib import admin

from .models import Family, LeadSource


@admin.register(LeadSource)
class LeadSourceAdmin(admin.ModelAdmin):
    list_display = ("source_name", "is_active", "created_at")
    list_filter = ("is_active",)
    search_fields = ("source_name", "description")


@admin.register(Family)
class FamilyAdmin(admin.ModelAdmin):
    list_display = ("family_name", "contact_email", "contact_phone", "created_at")
    search_fields = ("family_name", "contact_email", "contact_phone", "notes")

