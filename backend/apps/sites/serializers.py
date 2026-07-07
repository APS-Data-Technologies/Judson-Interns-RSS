from rest_framework import serializers

from .models import Location


class LocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Location
        fields = (
            "id",
            "location_name",
            "address",
            "city",
            "state",
            "zip_code",
            "phone",
            "is_active",
        )
