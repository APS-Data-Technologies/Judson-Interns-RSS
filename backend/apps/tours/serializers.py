from django.utils import timezone
from rest_framework import serializers

from apps.leads.models import Family
from apps.leads.models import LeadSource
from apps.sites.models import Location
from apps.tours.models import Tour, TourEvent, TourStatus


class TourSerializer(serializers.ModelSerializer):
    family_name = serializers.CharField(source="family.family_name", read_only=True)
    contact_email = serializers.EmailField(source="family.contact_email", read_only=True)
    contact_phone = serializers.CharField(source="family.contact_phone", read_only=True)
    location_name = serializers.CharField(source="location.location_name", read_only=True)
    lead_source_name = serializers.CharField(source="lead_source.source_name", read_only=True)
    assigned_staff_name = serializers.SerializerMethodField()
    status_label = serializers.CharField(source="get_current_status_display", read_only=True)
    events = serializers.SerializerMethodField()

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
            "events",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("assigned_staff", "created_at", "updated_at")

    def get_assigned_staff_name(self, obj):
        return obj.assigned_staff.get_full_name() or obj.assigned_staff.email

    def get_events(self, obj):
        return [
            {
                "id": event.id,
                "status": event.status,
                "status_label": event.get_status_display(),
                "event_timestamp": event.event_timestamp,
                "updated_by_name": event.updated_by.get_full_name() or event.updated_by.email,
                "notes": event.notes,
            }
            for event in obj.events.select_related("updated_by").all()
        ]


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


class TourUpdateSerializer(TourCreateSerializer):
    family_name = serializers.CharField(max_length=150, required=False)
    scheduled_tour_date = serializers.DateTimeField(required=False)
    location = serializers.PrimaryKeyRelatedField(
        queryset=Location.objects.filter(is_active=True),
        required=False,
    )
    lead_source = serializers.PrimaryKeyRelatedField(
        queryset=LeadSource.objects.filter(is_active=True),
        required=False,
    )

    def update(self, instance, validated_data):
        student_name = validated_data.pop("student_name", None)
        notes = validated_data.pop("notes", None)
        family_name = validated_data.pop("family_name", None)
        contact_email = validated_data.pop("contact_email", None)
        contact_phone = validated_data.pop("contact_phone", None)

        family = instance.family
        if family_name is not None:
            family.family_name = family_name.strip()
        if contact_email is not None:
            family.contact_email = contact_email
        if contact_phone is not None:
            family.contact_phone = contact_phone
        if notes is not None or student_name is not None:
            next_notes = notes if notes is not None else family.notes
            if student_name:
                next_notes = f"Student: {student_name}\n{next_notes}".strip()
            family.notes = next_notes
        family.save()

        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        return instance


class TourStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=TourStatus.choices)
    notes = serializers.CharField(required=False, allow_blank=True)

    def update(self, instance, validated_data):
        request = self.context["request"]
        instance.current_status = validated_data["status"]
        instance.save(update_fields=["current_status", "updated_at"])
        TourEvent.objects.create(
            tour=instance,
            status=validated_data["status"],
            event_timestamp=timezone.now(),
            updated_by=request.user,
            notes=validated_data.get("notes", ""),
        )
        return instance

    def to_representation(self, instance):
        return TourSerializer(instance).data


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
