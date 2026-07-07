from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from .models import Location
from .serializers import LocationSerializer


class LocationListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = LocationSerializer
    pagination_class = None

    def get_queryset(self):
        return Location.objects.filter(is_active=True).order_by("location_name")
