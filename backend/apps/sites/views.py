from rest_framework import mixins, viewsets
from rest_framework.permissions import IsAuthenticated

from apps.accounts.permissions import IsAdminOrSuperAdmin

from .models import Location
from .serializers import LocationSerializer, LocationWriteSerializer


class LocationViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    pagination_class = None

    def _include_inactive(self):
        return self.request.query_params.get("include_inactive") == "true"

    def get_queryset(self):
        queryset = Location.objects.all().order_by("location_name")
        if self.request.user.role == "staff" and self.request.user.location_id:
            queryset = queryset.filter(id=self.request.user.location_id)
        elif (
            self.request.user.role == "admin"
            and self.action == "list"
            and not self._include_inactive()
        ):
            queryset = queryset.filter(is_active=True)
        return queryset

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update"):
            permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return LocationWriteSerializer
        return LocationSerializer
