from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from .models import LeadSource
from .serializers import LeadSourceSerializer


class LeadSourceListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = LeadSourceSerializer
    pagination_class = None

    def get_queryset(self):
        return LeadSource.objects.filter(is_active=True).order_by("source_name")
