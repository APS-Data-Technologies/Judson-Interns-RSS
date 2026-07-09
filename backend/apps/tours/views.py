from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import User
from apps.accounts.permissions import filter_queryset_by_location
from apps.leads.models import LeadSource
from apps.sites.models import Location
from apps.tours.models import Tour, TourEvent, TourStatus

from .serializers import (
    HomeSummaryQuerySerializer,
    HomeTourSerializer,
    TourCreateSerializer,
    TourEventSerializer,
    TourRescheduleSerializer,
    TourSerializer,
    TourStatusTransitionSerializer,
    TourUpdateSerializer,
)


ALLOWED_STATUS_TRANSITIONS = {
    TourStatus.SCHEDULED: {
        TourStatus.TOURED,
        TourStatus.NO_SHOW,
        TourStatus.CANCELLED,
    },
    TourStatus.RESCHEDULED: {
        TourStatus.TOURED,
        TourStatus.NO_SHOW,
        TourStatus.CANCELLED,
    },
    TourStatus.TOURED: {
        TourStatus.ENROLLED,
        TourStatus.CHURNED,
    },
}


class TourViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Tour.objects.select_related(
            "family",
            "location",
            "lead_source",
            "assigned_staff",
        ).order_by("scheduled_tour_date", "family__family_name")
        queryset = filter_queryset_by_location(queryset, self.request.user)

        locations = self._param_list("location")
        lead_sources = self._param_list("lead_source")
        statuses = self._param_list("status")
        search = self.request.query_params.get("search")
        date_value = self.request.query_params.get("date")
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")

        if locations:
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
        if self.action == "transition_status":
            return TourStatusTransitionSerializer
        if self.action == "reschedule":
            return TourRescheduleSerializer
        if self.action == "events":
            return TourEventSerializer
        return TourSerializer

    def _get_locked_tour(self):
        return get_object_or_404(
            self.get_queryset().select_for_update(),
            pk=self.kwargs["pk"],
        )

    @action(detail=True, methods=["post"], url_path="status")
    def transition_status(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        next_status = serializer.validated_data["status"]

        with transaction.atomic():
            tour = self._get_locked_tour()
            allowed_statuses = ALLOWED_STATUS_TRANSITIONS.get(tour.current_status, set())
            if next_status not in allowed_statuses:
                return Response(
                    {
                        "status": [
                            f"Cannot transition from {tour.current_status} to {next_status}."
                        ]
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            tour.current_status = next_status
            tour.save(update_fields=["current_status", "updated_at"])
            TourEvent.objects.create(
                tour=tour,
                status=next_status,
                event_timestamp=timezone.now(),
                updated_by=request.user,
                notes=serializer.validated_data.get("notes", ""),
            )

        return Response(TourSerializer(tour, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def reschedule(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            tour = self._get_locked_tour()
            if tour.current_status not in {
                TourStatus.SCHEDULED,
                TourStatus.RESCHEDULED,
            }:
                return Response(
                    {"status": [f"Cannot reschedule a {tour.current_status} tour."]},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            tour.scheduled_tour_date = serializer.validated_data["scheduled_tour_date"]
            tour.current_status = TourStatus.RESCHEDULED
            tour.save(
                update_fields=["scheduled_tour_date", "current_status", "updated_at"]
            )
            TourEvent.objects.create(
                tour=tour,
                status=TourStatus.RESCHEDULED,
                event_timestamp=timezone.now(),
                updated_by=request.user,
                notes=serializer.validated_data.get("notes", ""),
            )

        return Response(TourSerializer(tour, context={"request": request}).data)

    @action(detail=True, methods=["get"])
    def events(self, request, *args, **kwargs):
        tour = self.get_object()
        events = tour.events.select_related("updated_by").all()
        serializer = self.get_serializer(events, many=True)
        return Response(serializer.data)


class HomeSummaryView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        query_serializer = HomeSummaryQuerySerializer(
            data=request.query_params,
            context={"request": request},
        )
        query_serializer.is_valid(raise_exception=True)
        filters = query_serializer.validated_data
        base_date = filters.get("date", timezone.localdate())
        date_from = filters.get("date_from")
        date_to = filters.get("date_to")
        yesterday = base_date - timezone.timedelta(days=1)
        booked_tours = self._filtered_tours(request.user, filters)
        no_show_tours = self._filtered_tours(request.user, filters)

        if date_from or date_to:
            if date_from:
                booked_tours = booked_tours.filter(scheduled_tour_date__date__gte=date_from)
                no_show_tours = no_show_tours.filter(scheduled_tour_date__date__gte=date_from)
            if date_to:
                booked_tours = booked_tours.filter(scheduled_tour_date__date__lte=date_to)
                no_show_tours = no_show_tours.filter(scheduled_tour_date__date__lte=date_to)
            booked_tours = booked_tours.filter(current_status=TourStatus.SCHEDULED)
            no_show_tours = no_show_tours.filter(current_status=TourStatus.NO_SHOW)
        else:
            booked_tours = booked_tours.filter(
                scheduled_tour_date__date=base_date,
                current_status=TourStatus.SCHEDULED,
            )
            no_show_tours = no_show_tours.filter(
                scheduled_tour_date__date=yesterday,
                current_status=TourStatus.NO_SHOW,
            )

        locations = Location.objects.filter(is_active=True)
        if request.user.role == User.Role.STAFF:
            locations = locations.filter(pk=request.user.location_id)

        return Response(
            {
                "date": base_date,
                "booked_tours": HomeTourSerializer(booked_tours, many=True).data,
                "no_show_tours": HomeTourSerializer(no_show_tours, many=True).data,
                "filters": {
                    "locations": list(
                        locations.order_by("location_name")
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

    def _filtered_tours(self, user, filters):
        queryset = Tour.objects.select_related(
            "family",
            "location",
            "lead_source",
            "assigned_staff",
        ).order_by("scheduled_tour_date", "family__family_name")
        queryset = filter_queryset_by_location(queryset, user)

        location = filters.get("location")
        lead_source = filters.get("lead_source")
        search = filters.get("search")

        if location:
            queryset = queryset.filter(location=location)
        if lead_source:
            queryset = queryset.filter(lead_source=lead_source)
        if search:
            queryset = queryset.filter(family__family_name__icontains=search)

        return queryset
