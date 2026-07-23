from django.http import HttpResponse
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .exports import export_analytics
from .search import global_search
from .core import apply_filters, base_queryset, parse_date
from .services import cohort_analytics
from .models import AnalyticsOperation
from .operations import analytics_engine_status, validate_analytics_engine


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
        queryset = apply_filters(base_queryset(request.user), request.query_params)
        date_from = parse_date(request.query_params.get("date_from") or request.query_params.get("dateFrom"))
        date_to = parse_date(request.query_params.get("date_to") or request.query_params.get("dateTo"))
        if date_from:
            queryset = queryset.filter(scheduled_tour_date__date__gte=date_from)
        if date_to:
            queryset = queryset.filter(scheduled_tour_date__date__lte=date_to)
        total = queryset.count()
        rows = [{
            "family": tour.family.family_name,
            "scheduledDate": tour.scheduled_tour_date.date().isoformat(),
            "status": tour.get_current_status_display(),
            "location": tour.location.location_name,
            "leadSource": str(tour.lead_source),
            "staff": tour.assigned_staff.get_full_name() or tour.assigned_staff.email,
        } for tour in queryset.order_by("-scheduled_tour_date")[:100]]
        return Response({"count": total, "rows": rows, "isTruncated": total > len(rows)})


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
