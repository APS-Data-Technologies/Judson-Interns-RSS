from rest_framework import generics, mixins, viewsets
from rest_framework.permissions import IsAuthenticated

from apps.accounts.permissions import IsAdminOrSuperAdmin

from .models import LeadSource
from .serializers import LeadSourceSerializer, LeadSourceWriteSerializer


class LeadSourceListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = LeadSourceSerializer
    pagination_class = None

    def get_queryset(self):
        return LeadSource.objects.filter(is_active=True).order_by("source_name")


class LeadSourceViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]
    pagination_class = None

    def get_queryset(self):
        queryset = LeadSource.objects.all().order_by("source_name")
        if self.action == "list" and self.request.query_params.get("include_inactive") != "true":
            queryset = queryset.filter(is_active=True)
        return queryset

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return LeadSourceWriteSerializer
        return LeadSourceSerializer
