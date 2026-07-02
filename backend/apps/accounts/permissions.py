from rest_framework.permissions import BasePermission

from .models import User


def is_super_admin(user):
    return bool(
        user
        and user.is_authenticated
        and (user.is_superuser or user.role == User.Role.SUPER_ADMIN)
    )


class IsSuperAdmin(BasePermission):
    message = "Only Super Admins can manage users."

    def has_permission(self, request, view):
        return is_super_admin(request.user)


class IsAdminOrSuperAdmin(BasePermission):
    message = "Administrator access is required."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (
                request.user.is_superuser
                or request.user.role in (User.Role.SUPER_ADMIN, User.Role.ADMIN)
            )
        )


class HasLocationAccess(BasePermission):
    message = "You do not have access to this location."

    def has_object_permission(self, request, view, obj):
        if is_super_admin(request.user) or request.user.role == User.Role.ADMIN:
            return True
        object_location_id = getattr(obj, "location_id", None)
        return object_location_id is not None and object_location_id == request.user.location_id


def filter_queryset_by_location(queryset, user, field_name="location"):
    if is_super_admin(user) or user.role == User.Role.ADMIN:
        return queryset
    return queryset.filter(**{field_name: user.location_id})
