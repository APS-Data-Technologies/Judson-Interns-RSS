from django.db import connection
from django.db.models import Max
from django.utils import timezone

from apps.reports.models import CostBasis
from apps.tours.models import Tour, TourEvent

from .models import AnalyticsOperation


METRIC_GROUPS = [
    {
        "name": "Activity",
        "definitions": [
            "Booked uses the tour creation date.",
            "Toured, No Show, Enrolled, and Churned use recorded event dates.",
            "Volume selections control the matching cost-efficiency measure.",
        ],
    },
    {
        "name": "Conversion",
        "definitions": [
            "Tour rate = toured families divided by booked families.",
            "Conversion rate = enrolled families divided by booked families.",
            "Close rate = enrolled families divided by toured families.",
            "Cohort views follow families booked or scheduled in the selected period.",
        ],
    },
    {
        "name": "Financial",
        "definitions": [
            "Revenue and costs use active monthly cost-basis records.",
            "Contribution margin = revenue minus costs.",
            "Margin % = contribution margin divided by revenue.",
            "The current incomplete month is excluded.",
        ],
    },
]


def _iso(value):
    return timezone.localtime(value).isoformat() if value else None


def analytics_engine_status():
    tour_latest = Tour.objects.aggregate(value=Max("updated_at"))["value"]
    event_latest = TourEvent.objects.aggregate(value=Max("event_timestamp"))["value"]
    finance_latest = CostBasis.objects.aggregate(value=Max("updated_at"))["value"]
    latest = max((value for value in [tour_latest, event_latest, finance_latest] if value), default=None)

    with connection.cursor() as cursor:
        cursor.execute("SELECT 1")
        database_ok = cursor.fetchone() == (1,)

    operations = AnalyticsOperation.objects.select_related("initiated_by")[:20]
    return {
        "generatedAt": timezone.now().isoformat(),
        "mode": "live",
        "health": {
            "status": "healthy" if database_ok else "attention",
            "database": database_ok,
            "latestSourceChange": _iso(latest),
            "sources": [
                {"name": "Tours", "records": Tour.objects.count(), "latestChange": _iso(tour_latest)},
                {"name": "Tour events", "records": TourEvent.objects.count(), "latestChange": _iso(event_latest)},
                {"name": "Financial records", "records": CostBasis.objects.filter(is_active=True).count(), "latestChange": _iso(finance_latest)},
            ],
        },
        "metricGroups": METRIC_GROUPS,
        "access": [
            {"role": "Staff", "scope": "Operational analytics for assigned location", "financials": False, "engineAdmin": False},
            {"role": "Admin", "scope": "Organization analytics and engine status", "financials": True, "engineAdmin": True},
            {"role": "Super Admin", "scope": "Full analytics, validation, and cost-basis management", "financials": True, "engineAdmin": True},
        ],
        "retention": {
            "status": "Policy required",
            "message": "Analytics reads retained operational history. No automated analytics purge is configured.",
            "purgeEnabled": False,
            "backupMessage": "Database backup retention is managed separately and is never changed from this page.",
        },
        "operations": [
            {
                "id": operation.id,
                "type": operation.get_operation_display(),
                "status": operation.status,
                "detail": operation.detail,
                "initiatedBy": str(operation.initiated_by) if operation.initiated_by else "System",
                "createdAt": operation.created_at.isoformat(),
            }
            for operation in operations
        ],
    }


def validate_analytics_engine(user):
    status = analytics_engine_status()
    operation = AnalyticsOperation.objects.create(
        operation=AnalyticsOperation.Operation.VALIDATION,
        status="completed" if status["health"]["status"] == "healthy" else "attention",
        detail="Live sources and database connectivity validated.",
        initiated_by=user,
    )
    return operation, analytics_engine_status()
