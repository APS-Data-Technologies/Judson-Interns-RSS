from rest_framework import serializers

from .models import Family, LeadSource


class LeadSourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeadSource
        fields = ("id", "external_id", "source_name", "description", "is_active")


class LeadSourceWriteSerializer(LeadSourceSerializer):
    class Meta(LeadSourceSerializer.Meta):
        read_only_fields = ("id",)

    def validate_source_name(self, value):
        normalized_value = value.strip()
        queryset = LeadSource.objects.filter(source_name__iexact=normalized_value)
        if self.instance is not None:
            queryset = queryset.exclude(id=self.instance.id)
        if queryset.exists():
            raise serializers.ValidationError("A lead source with this name already exists.")
        return normalized_value

    def validate_description(self, value):
        return value.strip()


class FamilySerializer(serializers.ModelSerializer):
    class Meta:
        model = Family
        fields = ("id", "family_name", "contact_email", "contact_phone", "notes")
