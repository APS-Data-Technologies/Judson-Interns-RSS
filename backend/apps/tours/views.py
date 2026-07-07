from django.utils import timezone
from rest_framework import generics, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.leads.models import LeadSource
from apps.sites.models import Location
from apps.tours.models import Tour, TourStatus

from .serializers import HomeTourSerializer, TourCreateSerializer, TourSerializer


class TourViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Tour.objects.select_related(
            "family",
            "location",
            "lead_source",
            "assigned_staff",
        ).order_by("scheduled_tour_date", "family__family_name")

        location = self.request.query_params.get("location")
        lead_source = self.request.query_params.get("lead_source")
        status_value = self.request.query_params.get("status")
        search = self.request.query_params.get("search")
        date_value = self.request.query_params.get("date")

        if location:
            queryset = queryset.filter(location_id=location)
        if lead_source:
            queryset = queryset.filter(lead_source_id=lead_source)
        if status_value:
            queryset = queryset.filter(current_status=status_value)
        if search:
            queryset = queryset.filter(family__family_name__icontains=search)
        if date_value:
            queryset = queryset.filter(scheduled_tour_date__date=date_value)

        return queryset

    def get_serializer_class(self):
        if self.action == "create":
            return TourCreateSerializer
        return TourSerializer


class HomeSummaryView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        date_value = request.query_params.get("date")
        base_date = self._parse_date(date_value)
        yesterday = base_date - timezone.timedelta(days=1)

        booked_tours = self._filtered_tours(request).filter(
            scheduled_tour_date__date=base_date,
            current_status=TourStatus.SCHEDULED,
        )
        no_show_tours = self._filtered_tours(request).filter(
            scheduled_tour_date__date=yesterday,
            current_status=TourStatus.NO_SHOW,
        )

        return Response(
            {
                "date": base_date,
                "booked_tours": HomeTourSerializer(booked_tours, many=True).data,
                "no_show_tours": HomeTourSerializer(no_show_tours, many=True).data,
                "filters": {
                    "locations": list(
                        Location.objects.filter(is_active=True)
                        .order_by("location_name")
                        .values("id", "location_name")
                    ),
                    "lead_sources": list(
                        LeadSource.objects.filter(is_active=True)
                        .order_by("source_name")
                        .values("id", "source_name")
                    ),
                    "statuses": [
                        {"value": TourStatus.SCHEDULED, "label": "Booked"},
                        {"value": TourStatus.NO_SHOW, "label": "No Show"},
                    ],
                },
            }
        )

    def _parse_date(self, date_value):
        if not date_value:
            return timezone.localdate()
        return timezone.datetime.fromisoformat(date_value).date()

    def _filtered_tours(self, request):
        queryset = Tour.objects.select_related(
            "family",
            "location",
            "lead_source",
            "assigned_staff",
        ).order_by("scheduled_tour_date", "family__family_name")

        location = request.query_params.get("location")
        lead_source = request.query_params.get("lead_source")
        search = request.query_params.get("search")

        if location:
            queryset = queryset.filter(location_id=location)
        if lead_source:
            queryset = queryset.filter(lead_source_id=lead_source)
        if search:
            queryset = queryset.filter(family__family_name__icontains=search)

        return queryset
