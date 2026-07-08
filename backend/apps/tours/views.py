from django.utils import timezone
from rest_framework import generics, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.leads.models import LeadSource
from apps.sites.models import Location
from apps.tours.models import Tour, TourStatus

from .serializers import (
    HomeTourSerializer,
    TourCreateSerializer,
    TourSerializer,
    TourStatusUpdateSerializer,
    TourUpdateSerializer,
)


class TourViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Tour.objects.select_related(
            "family",
            "location",
            "lead_source",
            "assigned_staff",
        ).prefetch_related("events__updated_by").order_by("scheduled_tour_date", "family__family_name")

        if self.request.user.role == "staff" and self.request.user.location_id:
            queryset = queryset.filter(location_id=self.request.user.location_id)

        locations = self._param_list("location")
        lead_sources = self._param_list("lead_source")
        statuses = self._param_list("status")
        search = self.request.query_params.get("search")
        date_value = self.request.query_params.get("date")
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")

        if locations and self.request.user.role != "staff":
            queryset = queryset.filter(location_id__in=locations)
        if lead_sources:
            queryset = queryset.filter(lead_source_id__in=lead_sources)
        if statuses:
            queryset = queryset.filter(current_status__in=statuses)
        if search:
            queryset = queryset.filter(family__family_name__icontains=search)
        if date_value:
            queryset = queryset.filter(scheduled_tour_date__date=date_value)
        if date_from:
            queryset = queryset.filter(scheduled_tour_date__date__gte=date_from)
        if date_to:
            queryset = queryset.filter(scheduled_tour_date__date__lte=date_to)

        return queryset

    def _param_list(self, name):
        value = self.request.query_params.get(name)
        if not value:
            return []
        return [item for item in value.split(",") if item]

    def get_serializer_class(self):
        if self.action == "create":
            return TourCreateSerializer
        if self.action in ("update", "partial_update"):
            return TourUpdateSerializer
        if self.action == "status":
            return TourStatusUpdateSerializer
        return TourSerializer

    @action(detail=True, methods=["post", "patch"], url_path="status")
    def status(self, request, pk=None):
        tour = self.get_object()
        serializer = self.get_serializer(tour, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


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
                        self._locations_for_user(request)
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

        if request.user.role == "staff" and request.user.location_id:
            queryset = queryset.filter(location_id=request.user.location_id)

        location = request.query_params.get("location")
        lead_source = request.query_params.get("lead_source")
        search = request.query_params.get("search")

        if location and request.user.role != "staff":
            queryset = queryset.filter(location_id=location)
        if lead_source:
            queryset = queryset.filter(lead_source_id=lead_source)
        if search:
            queryset = queryset.filter(family__family_name__icontains=search)

        return queryset

    def _locations_for_user(self, request):
        queryset = Location.objects.filter(is_active=True).order_by("location_name")
        if request.user.role == "staff" and request.user.location_id:
            queryset = queryset.filter(id=request.user.location_id)
        return queryset
