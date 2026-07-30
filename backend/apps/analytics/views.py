import re

from django.http import HttpResponse
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .exports import export_analytics, export_drill_through
from .search import global_search
from .core import apply_filters, base_queryset, parse_date
from .metrics import (
    PROGRESS_BUCKETS,
    SHORT_PROGRESS_BUCKETS,
    average_days_to_enroll,
    reached_status,
    volume_event_date,
    volume_event_timestamp,
)
from .services import cohort_analytics
from .models import AnalyticsOperation
from .operations import analytics_engine_status, validate_analytics_engine
from apps.tours.models import TourStatus
from apps.accounts.models import User
from apps.accounts.permissions import filter_queryset_by_location
from apps.reports.models import CostBasis


def student_name_from_notes(notes):
    for line in (notes or "").splitlines():
        label, separator, value = line.partition(":")
        if separator and label.strip().lower() == "student":
            return value.strip() or "—"
    return "—"


def drill_through_row(tour, contribution_date, contributing_kpi, metric_role=None):
    return {
        "tourId": tour.id,
        "contributingKpi": contributing_kpi,
        "contributionDate": contribution_date.isoformat(),
        "familyName": tour.family.family_name,
        **({"metricRole": metric_role} if metric_role else {}),
        "scheduledDateTime": tour.scheduled_tour_date.isoformat(),
        "location": tour.location.location_name,
        "currentStatus": tour.get_current_status_display(),
        "assignedStaff": tour.assigned_staff.get_full_name() or tour.assigned_staff.email,
        "leadSource": str(tour.lead_source),
        "studentName": student_name_from_notes(tour.family.notes),
        "childGrade": tour.child_grade or "—",
        "emailPhone": " · ".join(filter(None, [
            tour.family.contact_email,
            tour.family.contact_phone,
        ])) or "—",
    }


def apply_drill_dimension(queryset, dimension, value):
    if not dimension or not value:
        return queryset
    lookups = {
        "location": "location__location_name",
        "lead_source": "lead_source__source_name",
        "staff": "assigned_staff",
    }
    lookup = lookups.get(dimension)
    if not lookup:
        return queryset
    if dimension == "staff":
        matching_ids = [
            tour.id for tour in queryset
            if (tour.assigned_staff.get_full_name() or tour.assigned_staff.email).casefold()
            == value.casefold()
        ]
        return queryset.filter(id__in=matching_ids)
    return queryset.filter(**{f"{lookup}__iexact": value})


def matches_temporal_bucket(contribution_date, dimension, value):
    if not dimension or value in (None, ""):
        return True
    numeric_value = int(value)
    if dimension == "quarter":
        return ((contribution_date.month - 1) // 3) + 1 == numeric_value
    if dimension == "month":
        return contribution_date.month - 1 == numeric_value
    if dimension == "week":
        return ((contribution_date.day - 1) // 7) + 1 == numeric_value
    if dimension == "dayOfMonth":
        return contribution_date.day == numeric_value
    if dimension == "dayOfWeek":
        return (contribution_date.weekday() + 1) % 7 == numeric_value
    return True


def drill_response(request, rows):
    if request.query_params.get("export") == "xlsx":
        content = export_drill_through(rows, request.query_params)
        AnalyticsOperation.objects.create(
            operation=AnalyticsOperation.Operation.EXPORT,
            detail=f'Drill-through XLSX · {request.query_params.get("drill_kpi", "Analytics metric")}',
            initiated_by=request.user,
        )
        response = HttpResponse(
            content,
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        filename_parts = [
            request.query_params.get("drill_page"),
            request.query_params.get("drill_section"),
            request.query_params.get("drill_visualization"),
            request.query_params.get("drill_kpi"),
        ]
        filename_parts = [
            re.sub(r'[<>:"/\\|?*\x00-\x1f]+', "-", str(part)).strip(" .-")
            for part in filename_parts
            if part
        ]
        filename = " - ".join(filename_parts)[:180].rstrip(" .-") or "Analytics Drill-Through"
        response["Content-Disposition"] = f'attachment; filename="{filename}.xlsx"'
        return response
    visible_rows = rows[:100]
    return Response({
        "count": len(rows),
        "rows": visible_rows,
        "isTruncated": len(rows) > len(visible_rows),
    })


class CohortAnalyticsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(cohort_analytics(request.user, request.query_params))


class AnalyticsExportView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        content, content_type, filename = export_analytics(request.user, request.data)
        AnalyticsOperation.objects.create(
            operation=AnalyticsOperation.Operation.EXPORT,
            detail=f'{request.data.get("format", "xlsx").upper()} · {request.data.get("scope", "current page")}',
            initiated_by=request.user,
        )
        response = HttpResponse(content, content_type=content_type)
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response


class AnalyticsDrillThroughView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        date_from = parse_date(request.query_params.get("date_from") or request.query_params.get("dateFrom"))
        date_to = parse_date(request.query_params.get("date_to") or request.query_params.get("dateTo"))
        if request.query_params.get("drill_scope") == "all":
            date_from = None
            date_to = None
        drill_financial = request.query_params.get("drill_financial")
        drill_kpi = request.query_params.get("drill_kpi", "").strip()[:100] or "Analytics metric"
        if drill_financial in {"revenue", "cost", "margin"}:
            if request.user.role not in {"admin", "super_admin"}:
                return Response(
                    {"detail": "You do not have permission to view financial analytics."},
                    status=403,
                )
            entries = filter_queryset_by_location(
                CostBasis.objects.filter(is_active=True).select_related("location"),
                request.user,
            )
            location_ids = request.query_params.get("location") or request.query_params.get("locations")
            if location_ids:
                entries = entries.filter(location_id__in=[
                    value.strip() for value in location_ids.split(",") if value.strip()
                ])
            if (
                request.query_params.get("drill_dimension") == "location"
                and request.query_params.get("drill_dimension_value")
            ):
                entries = entries.filter(
                    location__location_name=request.query_params.get("drill_dimension_value")
                )
            staff_ids = request.query_params.get("staff")
            if staff_ids:
                staff_location_ids = User.objects.filter(
                    id__in=[value.strip() for value in staff_ids.split(",") if value.strip()],
                    location_id__isnull=False,
                ).values_list("location_id", flat=True)
                entries = entries.filter(location_id__in=staff_location_ids)
            if date_from:
                entries = entries.filter(reporting_month__gte=date_from.replace(day=1))
            if date_to:
                entries = entries.filter(reporting_month__lte=date_to.replace(day=1))
            if drill_financial == "revenue":
                entries = entries.filter(cost_type=CostBasis.CostType.REVENUE)
            elif drill_financial == "cost":
                entries = entries.filter(cost_type=CostBasis.CostType.EXPENDITURE)
            entries = list(entries.order_by("-reporting_month", "location__location_name"))
            rows = [{
                "financialEntryId": entry.id,
                "contributingKpi": drill_kpi,
                "reportingMonth": entry.reporting_month.isoformat(),
                "location": entry.location.location_name,
                "type": entry.get_cost_type_display(),
                "amount": str(entry.cost_amount),
                "notes": entry.notes or "—",
            } for entry in entries]
            return drill_response(request, rows)

        queryset = apply_filters(base_queryset(request.user), request.query_params)
        queryset = apply_drill_dimension(
            queryset,
            request.query_params.get("drill_dimension"),
            request.query_params.get("drill_dimension_value"),
        )
        drill_status = request.query_params.get("drill_status")
        drill_mode = request.query_params.get("drill_mode")
        drill_pending = request.query_params.get("drill_pending")
        if drill_pending in {"tour_outcome", "final_outcome", "all"}:
            cohort_tours = [
                tour for tour in queryset.order_by("-scheduled_tour_date")
                if (not date_from or tour.scheduled_tour_date.date() >= date_from)
                and (not date_to or tour.scheduled_tour_date.date() <= date_to)
            ]
            average_days = average_days_to_enroll(cohort_tours)
            today = timezone.localdate()
            pending_tours = []
            for tour in cohort_tours:
                tour_date = timezone.localtime(tour.scheduled_tour_date).date()
                tour_outcome_matches = (
                        tour.current_status in {TourStatus.SCHEDULED, TourStatus.RESCHEDULED}
                        and tour_date < today
                        and not reached_status(tour, TourStatus.TOURED)
                        and not reached_status(tour, TourStatus.NO_SHOW)
                )
                final_outcome_matches = (
                        average_days is not None
                        and reached_status(tour, TourStatus.TOURED)
                        and not reached_status(tour, TourStatus.ENROLLED)
                        and not reached_status(tour, TourStatus.CHURNED)
                        and (today - tour_date).days > average_days
                )
                matches = (
                    tour_outcome_matches if drill_pending == "tour_outcome"
                    else final_outcome_matches if drill_pending == "final_outcome"
                    else tour_outcome_matches or final_outcome_matches
                )
                if matches:
                    pending_tours.append(tour)
            return drill_response(request, [
                drill_through_row(tour, tour.scheduled_tour_date.date(), drill_kpi)
                for tour in pending_tours
            ])
        drill_transition = request.query_params.get("drill_transition")
        drill_transitions = [
            value.strip()
            for value in request.query_params.get("drill_transitions", "").split(",")
            if value.strip()
        ]
        if drill_transition or drill_transitions:
            transitions = {
                "booked_to_toured": ("Booked → Toured", "scheduled", "toured"),
                "booked_to_no_show": ("Booked → No Show", "scheduled", "no_show"),
                "toured_to_enrolled": ("Toured → Enrolled", "toured", "enrolled"),
                "toured_to_churned": ("Toured → Churned", "toured", "churned"),
                "booked_to_enrolled": ("Booked → Enrolled", "tour_date", "enrolled"),
            }
            requested_transitions = drill_transitions or [drill_transition]
            progress_buckets = (
                SHORT_PROGRESS_BUCKETS
                if date_from and date_to and ((date_to - date_from).days + 1) < 20
                else PROGRESS_BUCKETS
            )
            minimum = request.query_params.get("drill_elapsed_min")
            maximum = request.query_params.get("drill_elapsed_max")
            minimum = int(minimum) if minimum not in (None, "") else None
            maximum = int(maximum) if maximum not in (None, "") else None
            transition_rows = []
            for transition_key in requested_transitions:
                transition_label, source_status, destination_status = transitions.get(
                    transition_key, (None, None, None)
                )
                if not source_status:
                    continue
                for tour in queryset.order_by("-scheduled_tour_date"):
                    scheduled_date = timezone.localtime(tour.scheduled_tour_date).date()
                    if date_from and scheduled_date < date_from:
                        continue
                    if date_to and scheduled_date > date_to:
                        continue
                    if source_status == "scheduled":
                        source = timezone.localtime(tour.created_at)
                    elif source_status == "tour_date":
                        source = timezone.localtime(tour.scheduled_tour_date)
                    else:
                        source = volume_event_timestamp(tour, source_status)
                    destination = volume_event_timestamp(tour, destination_status)
                    if not source or not destination or destination < source:
                        continue
                    elapsed_days = (destination.date() - source.date()).days
                    if minimum is not None and elapsed_days < minimum:
                        continue
                    if maximum is not None and elapsed_days > maximum:
                        continue
                    row = drill_through_row(
                        tour,
                        destination.date(),
                        transition_label if len(requested_transitions) > 1 else drill_kpi,
                    )
                    row["elapsedDays"] = elapsed_days
                    row["elapsedBucket"] = next(
                        (
                            label for label, bucket_minimum, bucket_maximum in progress_buckets
                            if elapsed_days >= bucket_minimum
                            and (bucket_maximum is None or elapsed_days <= bucket_maximum)
                        ),
                        "Outside configured buckets",
                    )
                    transition_rows.append(row)
            return drill_response(request, transition_rows)
        drill_denominator = request.query_params.get("drill_denominator")
        temporal_dimension = request.query_params.get("drill_temporal_dimension")
        temporal_value = request.query_params.get("drill_temporal_value")
        drill_numerators = {
            status.strip()
            for status in request.query_params.get("drill_numerator", "").split(",")
            if status.strip()
        }
        allowed_statuses = {
            TourStatus.SCHEDULED,
            TourStatus.TOURED,
            TourStatus.NO_SHOW,
            TourStatus.ENROLLED,
            TourStatus.CHURNED,
        }
        requested_statuses = [
            status.strip()
            for status in request.query_params.get("drill_statuses", "").split(",")
            if status.strip() in allowed_statuses
        ]
        if requested_statuses:
            status_labels = {
                TourStatus.SCHEDULED: "Booked",
                TourStatus.TOURED: "Toured",
                TourStatus.NO_SHOW: "No Show",
                TourStatus.ENROLLED: "Enrolled",
                TourStatus.CHURNED: "Churned",
            }
            contributions = [
                (tour, status, volume_event_date(tour, status))
                for tour in queryset.order_by("-scheduled_tour_date")
                for status in requested_statuses
            ]
            contributions = [
                (tour, status, event_date)
                for tour, status, event_date in contributions
                if event_date
                and (not date_from or event_date >= date_from)
                and (not date_to or event_date <= date_to)
                and matches_temporal_bucket(event_date, temporal_dimension, temporal_value)
            ]
            contributions.sort(key=lambda item: item[2], reverse=True)
            rows = [
                drill_through_row(tour, event_date, status_labels[status])
                for tour, status, event_date in contributions
            ]
            return drill_response(request, rows)
        contribution_roles = {}
        if drill_denominator in allowed_statuses:
            tours = [
                tour for tour in queryset.order_by("-scheduled_tour_date")
                if (not date_from or tour.scheduled_tour_date.date() >= date_from)
                and (not date_to or tour.scheduled_tour_date.date() <= date_to)
                and reached_status(tour, drill_denominator)
                and matches_temporal_bucket(
                    tour.scheduled_tour_date.date(), temporal_dimension, temporal_value,
                )
            ]
            contribution_dates = {
                tour.id: tour.scheduled_tour_date.date()
                for tour in tours
            }
            contribution_roles = {
                tour.id: "Numerator" if any(reached_status(tour, status) for status in drill_numerators) else "Denominator only"
                for tour in tours
            }
        elif drill_status in allowed_statuses:
            tours = list(queryset.order_by("-scheduled_tour_date"))
            if drill_mode == "cohort":
                tours = [
                    tour for tour in tours
                    if (not date_from or tour.scheduled_tour_date.date() >= date_from)
                    and (not date_to or tour.scheduled_tour_date.date() <= date_to)
                    and reached_status(tour, drill_status)
                    and matches_temporal_bucket(
                        tour.scheduled_tour_date.date(), temporal_dimension, temporal_value,
                    )
                ]
                contribution_dates = {
                    tour.id: tour.scheduled_tour_date.date()
                    for tour in tours
                }
            else:
                contributions = [
                    (tour, volume_event_date(tour, drill_status))
                    for tour in tours
                ]
                contributions = [
                    (tour, event_date) for tour, event_date in contributions
                    if event_date
                    and (not date_from or event_date >= date_from)
                    and (not date_to or event_date <= date_to)
                    and matches_temporal_bucket(event_date, temporal_dimension, temporal_value)
                ]
                tours = [tour for tour, _ in contributions]
                contribution_dates = {
                    tour.id: event_date
                    for tour, event_date in contributions
                }
        else:
            if date_from:
                queryset = queryset.filter(scheduled_tour_date__date__gte=date_from)
            if date_to:
                queryset = queryset.filter(scheduled_tour_date__date__lte=date_to)
            tours = list(queryset.order_by("-scheduled_tour_date"))
            tours = [
                tour for tour in tours
                if matches_temporal_bucket(
                    tour.scheduled_tour_date.date(), temporal_dimension, temporal_value,
                )
            ]
            contribution_dates = {
                tour.id: tour.scheduled_tour_date.date()
                for tour in tours
            }
        rows = [
            drill_through_row(
                tour,
                contribution_dates[tour.id],
                drill_kpi,
                contribution_roles.get(tour.id),
            )
            for tour in tours
        ]
        return drill_response(request, rows)


class GlobalSearchView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(global_search(
            request.user,
            request.query_params.get("q", ""),
            request.query_params.get("limit", 5),
        ))


class AnalyticsEngineAdminView(APIView):
    permission_classes = [IsAuthenticated]

    def _authorized(self, request):
        return request.user.role in {"admin", "super_admin"}

    def get(self, request):
        if not self._authorized(request):
            return Response({"detail": "You do not have permission to view analytics administration."}, status=403)
        return Response(analytics_engine_status())

    def post(self, request):
        if request.user.role != "super_admin":
            return Response({"detail": "Only super admins can run engine validation."}, status=403)
        if request.data.get("action") != "validate":
            return Response({"detail": "Unsupported action."}, status=400)
        _, status = validate_analytics_engine(request.user)
        return Response(status)
