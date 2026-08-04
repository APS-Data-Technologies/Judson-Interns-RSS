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
    date_from = serializers.DateField(required=False)
    date_to = serializers.DateField(required=False)
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
            "student_name",
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
    existing_family = serializers.PrimaryKeyRelatedField(
        queryset=Family.objects.all(),
        required=False,
        write_only=True,
    )
    create_new_family = serializers.BooleanField(
        default=False,
        required=False,
        write_only=True,
    )
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

    def validate(self, attrs):
        request = self.context["request"]
        family_name = attrs["family_name"].strip()
        existing_family = attrs.get("existing_family")
        create_new_family = attrs.get("create_new_family", False)

        accessible_matches = Family.objects.filter(family_name__iexact=family_name)
        if request.user.role == User.Role.STAFF:
            accessible_matches = accessible_matches.filter(
                tours__location_id=request.user.location_id,
            ).distinct()

        if existing_family is not None:
            if not accessible_matches.filter(pk=existing_family.pk).exists():
                raise serializers.ValidationError(
                    {"existing_family": "Select an accessible family with the same name."}
                )
        elif not create_new_family and accessible_matches.exists():
            raise serializers.ValidationError({
                "family_matches": [
                    {
                        "id": family.id,
                        "family_name": family.family_name,
                        "contact_email": family.contact_email,
                        "contact_phone": family.contact_phone,
                    }
                    for family in accessible_matches.order_by("family_name", "id")[:5]
                ],
            })

        attrs["family_name"] = family_name
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        request = self.context["request"]
        existing_family = validated_data.pop("existing_family", None)
        validated_data.pop("create_new_family", False)
        notes = validated_data.pop("notes", "")
        family_name = validated_data.pop("family_name").strip()
        contact_email = validated_data.pop("contact_email", "")
        contact_phone = validated_data.pop("contact_phone", "")

        family = existing_family
        if family is None:
            family = Family.objects.create(
                family_name=family_name,
                contact_email=contact_email,
                contact_phone=contact_phone,
                notes=notes,
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
    family_name = serializers.CharField(max_length=150, required=False)
    contact_email = serializers.EmailField(required=False, allow_blank=True)
    contact_phone = serializers.CharField(max_length=20, required=False, allow_blank=True)

    class Meta:
        model = Tour
        fields = (
            "family_name",
            "contact_email",
            "contact_phone",
            "location",
            "lead_source",
            "student_name",
            "child_grade",
        )

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

    def validate_location(self, location):
        user = self.context["request"].user
        if user.role == User.Role.STAFF and location.pk != user.location_id:
            raise serializers.ValidationError("You do not have access to this location.")
        return location

    @transaction.atomic
    def update(self, instance, validated_data):
        family_fields = {
            field: validated_data.pop(field)
            for field in ("family_name", "contact_email", "contact_phone")
            if field in validated_data
        }

        if family_fields:
            family = instance.family
            if "family_name" in family_fields:
                family.family_name = family_fields["family_name"].strip()
            if "contact_email" in family_fields:
                family.contact_email = family_fields["contact_email"]
            if "contact_phone" in family_fields:
                family.contact_phone = family_fields["contact_phone"]
            family.save(
                update_fields=[
                    "family_name",
                    "contact_email",
                    "contact_phone",
                    "updated_at",
                ]
            )

        return super().update(instance, validated_data)

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
