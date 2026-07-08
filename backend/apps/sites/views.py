from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from .models import Location
from .serializers import LocationSerializer


class LocationListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = LocationSerializer
    pagination_class = None

    def get_queryset(self):
        queryset = Location.objects.filter(is_active=True).order_by("location_name")
        if self.request.user.role == "staff" and self.request.user.location_id:
            queryset = queryset.filter(id=self.request.user.location_id)
        return queryset
