from rest_framework import serializers

from .models import Family, LeadSource


class LeadSourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeadSource
        fields = ("id", "source_name", "description", "is_active")


class FamilySerializer(serializers.ModelSerializer):
    class Meta:
        model = Family
        fields = ("id", "family_name", "contact_email", "contact_phone", "notes")
