from django.contrib import admin

from .models import Tour, TourEvent


class TourEventInline(admin.TabularInline):
    model = TourEvent
    extra = 0
    can_delete = False
    readonly_fields = ("status", "event_timestamp", "updated_by", "notes")

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Tour)
class TourAdmin(admin.ModelAdmin):
    list_display = ("family", "location", "lead_source", "assigned_staff", "scheduled_tour_date", "current_status")
    list_filter = ("current_status", "location", "lead_source", "scheduled_tour_date")
    search_fields = ("family__family_name", "assigned_staff__email", "child_grade")
    date_hierarchy = "scheduled_tour_date"
    inlines = [TourEventInline]

    def get_readonly_fields(self, request, obj=None):
        if obj:
            return ("scheduled_tour_date", "current_status")
        return ()

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(TourEvent)
class TourEventAdmin(admin.ModelAdmin):
    list_display = ("tour", "status", "event_timestamp", "updated_by")
    list_filter = ("status", "event_timestamp")
    search_fields = ("tour__family__family_name", "updated_by__email", "notes")
    date_hierarchy = "event_timestamp"
    readonly_fields = ("tour", "status", "event_timestamp", "updated_by", "notes")

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
