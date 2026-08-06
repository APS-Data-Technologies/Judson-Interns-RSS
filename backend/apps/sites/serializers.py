from rest_framework import serializers

from .models import Location


class LocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Location
        fields = (
            "id",
            "external_id",
            "location_name",
            "address",
            "city",
            "state",
            "zip_code",
            "phone",
            "is_active",
        )


class LocationWriteSerializer(LocationSerializer):
    class Meta(LocationSerializer.Meta):
        read_only_fields = ("id",)

    def validate_location_name(self, value):
        normalized_value = value.strip()
        queryset = Location.objects.filter(location_name__iexact=normalized_value)
        if self.instance is not None:
            queryset = queryset.exclude(id=self.instance.id)
        if queryset.exists():
            raise serializers.ValidationError("A location with this name already exists.")
        return normalized_value

    def validate_state(self, value):
        normalized_value = value.strip().upper()
        if len(normalized_value) != 2:
            raise serializers.ValidationError("State must be a 2-letter abbreviation.")
        return normalized_value

    def validate_zip_code(self, value):
        return value.strip()

    def validate_address(self, value):
        return value.strip()

    def validate_city(self, value):
        return value.strip()

    def validate_phone(self, value):
        return value.strip()
