import uuid

from rest_framework import serializers

from .models import CostBasis


class CostBasisSerializer(serializers.ModelSerializer):
    location_name = serializers.CharField(source="location.location_name", read_only=True)

    class Meta:
        model = CostBasis
        fields = (
            "id",
            "external_id",
            "location",
            "location_name",
            "reporting_month",
            "cost_type",
            "cost_amount",
            "notes",
            "is_active",
        )
        read_only_fields = ("id", "location_name")

    def validate_reporting_month(self, value):
        if value.day != 1:
            raise serializers.ValidationError("Reporting month must be the first day of the month.")
        return value

    def validate_cost_amount(self, value):
        if value < 0:
            raise serializers.ValidationError("Cost amount cannot be negative.")
        return value

    def create(self, validated_data):
        if not validated_data.get("external_id"):
            validated_data["external_id"] = f"COST-{uuid.uuid4().hex}"
        return super().create(validated_data)
