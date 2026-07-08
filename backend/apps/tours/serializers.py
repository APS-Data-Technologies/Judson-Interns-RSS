from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from apps.accounts.models import User
from apps.leads.models import Family
from apps.leads.models import LeadSource
from apps.sites.models import Location
from apps.tours.models import Tour, TourEvent, TourStatus


class HomeSummaryQuerySerializer(serializers.Serializer):
    date = serializers.DateField(required=False)
    location = serializers.PrimaryKeyRelatedField(
        queryset=Location.objects.filter(is_active=True),
        required=False,
    )
    lead_source = serializers.PrimaryKeyRelatedField(
        queryset=LeadSource.objects.filter(is_active=True),
        required=False,
    )
    search = serializers.CharField(required=False, allow_blank=True, max_length=150)

    def validate_location(self, location):
        user = self.context["request"].user
        if user.role == User.Role.STAFF and location.pk != user.location_id:
            raise serializers.ValidationError("You do not have access to this location.")
        return location


class TourSerializer(serializers.ModelSerializer):
    family_name = serializers.CharField(source="family.family_name", read_only=True)
    contact_email = serializers.EmailField(source="family.contact_email", read_only=True)
    contact_phone = serializers.CharField(source="family.contact_phone", read_only=True)
    location_name = serializers.CharField(source="location.location_name", read_only=True)
    lead_source_name = serializers.CharField(source="lead_source.source_name", read_only=True)
    assigned_staff_name = serializers.SerializerMethodField()
    status_label = serializers.CharField(source="get_current_status_display", read_only=True)

    class Meta:
        model = Tour
        fields = (
            "id",
            "family",
            "family_name",
            "contact_email",
            "contact_phone",
            "location",
            "location_name",
            "lead_source",
            "lead_source_name",
            "assigned_staff",
            "assigned_staff_name",
            "child_grade",
            "scheduled_tour_date",
            "current_status",
            "status_label",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "assigned_staff",
            "scheduled_tour_date",
            "current_status",
            "created_at",
            "updated_at",
        )

    def get_assigned_staff_name(self, obj):
        return obj.assigned_staff.get_full_name() or obj.assigned_staff.email


class TourCreateSerializer(serializers.Serializer):
    family_name = serializers.CharField(max_length=150)
    student_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    contact_email = serializers.EmailField(required=False, allow_blank=True)
    contact_phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    location = serializers.PrimaryKeyRelatedField(queryset=Location.objects.filter(is_active=True))
    lead_source = serializers.PrimaryKeyRelatedField(queryset=LeadSource.objects.filter(is_active=True))
    child_grade = serializers.CharField(max_length=50, required=False, allow_blank=True)
    scheduled_tour_date = serializers.DateTimeField()
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate_location(self, location):
        user = self.context["request"].user
        if user.role == User.Role.STAFF and location.pk != user.location_id:
            raise serializers.ValidationError("You do not have access to this location.")
        return location

    @transaction.atomic
    def create(self, validated_data):
        request = self.context["request"]
        student_name = validated_data.pop("student_name", "")
        notes = validated_data.pop("notes", "")
        family_name = validated_data.pop("family_name").strip()
        contact_email = validated_data.pop("contact_email", "")
        contact_phone = validated_data.pop("contact_phone", "")

        family_notes = notes
        if student_name:
            family_notes = f"Student: {student_name}\n{notes}".strip()

        family, _ = Family.objects.update_or_create(
            family_name=family_name,
            defaults={
                "contact_email": contact_email,
                "contact_phone": contact_phone,
                "notes": family_notes,
            },
        )
        tour = Tour.objects.create(
            family=family,
            assigned_staff=request.user,
            current_status=TourStatus.SCHEDULED,
            **validated_data,
        )
        TourEvent.objects.create(
            tour=tour,
            status=TourStatus.SCHEDULED,
            event_timestamp=timezone.now(),
            updated_by=request.user,
            notes="Tour scheduled.",
        )
        return tour

    def to_representation(self, instance):
        return TourSerializer(instance).data


class TourUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tour
        fields = ("lead_source", "child_grade")

    def validate(self, attrs):
        protected_fields = {"current_status", "scheduled_tour_date"}
        attempted_fields = protected_fields.intersection(self.initial_data)
        if attempted_fields:
            raise serializers.ValidationError(
                {
                    field: "Use the dedicated workflow endpoint to update this field."
                    for field in sorted(attempted_fields)
                }
            )
        return attrs

    def to_representation(self, instance):
        return TourSerializer(instance, context=self.context).data


class TourStatusTransitionSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=TourStatus.choices)
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate_status(self, status_value):
        if status_value == TourStatus.RESCHEDULED:
            raise serializers.ValidationError("Use the reschedule endpoint for this status.")
        return status_value


class TourRescheduleSerializer(serializers.Serializer):
    scheduled_tour_date = serializers.DateTimeField()
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate_scheduled_tour_date(self, scheduled_tour_date):
        if scheduled_tour_date <= timezone.now():
            raise serializers.ValidationError("The new tour date must be in the future.")
        return scheduled_tour_date


class TourEventSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    updated_by_name = serializers.SerializerMethodField()

    class Meta:
        model = TourEvent
        fields = (
            "id",
            "status",
            "status_label",
            "event_timestamp",
            "updated_by",
            "updated_by_name",
            "notes",
        )
        read_only_fields = fields

    def get_updated_by_name(self, obj):
        return obj.updated_by.get_full_name() or obj.updated_by.email


class HomeTourSerializer(TourSerializer):
    class Meta(TourSerializer.Meta):
        fields = (
            "id",
            "family_name",
            "contact_email",
            "contact_phone",
            "location",
            "location_name",
            "lead_source",
            "lead_source_name",
            "child_grade",
            "scheduled_tour_date",
            "current_status",
            "status_label",
        )
