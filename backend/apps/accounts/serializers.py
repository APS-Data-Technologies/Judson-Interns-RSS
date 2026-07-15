from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework.authtoken.models import Token

from apps.sites.models import Location

from .models import User


class UserSerializer(serializers.ModelSerializer):
    location_name = serializers.CharField(source="location.location_name", read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "first_name",
            "last_name",
            "role",
            "location",
            "location_name",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class UserWriteSerializer(UserSerializer):
    password = serializers.CharField(write_only=True, min_length=8, required=False)

    class Meta(UserSerializer.Meta):
        fields = UserSerializer.Meta.fields + ("password",)

    def validate_email(self, value):
        normalized_email = value.strip().lower()
        users = User.objects.filter(email__iexact=normalized_email)
        if self.instance is not None:
            users = users.exclude(id=self.instance.id)
        if users.exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return normalized_email

    def validate_password(self, value):
        try:
            validate_password(value, self.instance)
        except DjangoValidationError as error:
            raise serializers.ValidationError(error.messages) from error
        return value

    def validate(self, attrs):
        role = attrs.get("role", getattr(self.instance, "role", User.Role.STAFF))
        location = attrs.get("location", getattr(self.instance, "location", None))
        if role == User.Role.STAFF and location is None:
            raise serializers.ValidationError({"location": "Staff users must be assigned to a location."})
        if role != User.Role.STAFF and location is not None:
            raise serializers.ValidationError({"location": "Only Staff users can be assigned to a location."})
        if self.instance is None and not attrs.get("password"):
            raise serializers.ValidationError({"password": "A password is required."})
        request = self.context.get("request")
        if self.instance is not None and request and self.instance == request.user:
            if attrs.get("is_active") is False:
                raise serializers.ValidationError({"is_active": "You cannot deactivate your own account."})
            if attrs.get("role", self.instance.role) != User.Role.SUPER_ADMIN:
                raise serializers.ValidationError({"role": "You cannot remove your own Super Admin role."})
            if attrs.get("password"):
                raise serializers.ValidationError(
                    {"password": "Use the change-password endpoint for your own account."}
                )
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        role = validated_data.get("role", User.Role.STAFF)
        validated_data["is_staff"] = role == User.Role.SUPER_ADMIN
        validated_data["is_superuser"] = role == User.Role.SUPER_ADMIN
        return User.objects.create_user(password=password, **validated_data)

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        role = validated_data.get("role", instance.role)
        validated_data["is_staff"] = role == User.Role.SUPER_ADMIN
        validated_data["is_superuser"] = role == User.Role.SUPER_ADMIN
        instance = super().update(instance, validated_data)
        if password:
            instance.set_password(password)
            instance.save(update_fields=["password"])
            Token.objects.filter(user=instance).delete()
        return instance


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password = serializers.CharField(write_only=True, min_length=8, trim_whitespace=False)

    def validate_current_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        return value.strip().lower()


class PasswordResetConfirmSerializer(serializers.Serializer):
    token = serializers.CharField(write_only=True, min_length=32, max_length=128, trim_whitespace=False)
    new_password = serializers.CharField(write_only=True, min_length=8, trim_whitespace=False)

    def validate_new_password(self, value):
        try:
            validate_password(value, self.context["request"].user)
        except DjangoValidationError as error:
            raise serializers.ValidationError(error.messages) from error
        return value


class UserLocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Location
        fields = ("id", "location_name")


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        user = authenticate(
            request=self.context.get("request"),
            email=attrs["email"].strip().lower(),
            password=attrs["password"],
        )
        if user is None or not user.is_active:
            raise serializers.ValidationError("Invalid email or password.")
        attrs["user"] = user
        return attrs
