from datetime import datetime, timedelta

from apps.accounts.permissions import filter_queryset_by_location
from apps.tours.models import Tour


def percent(numerator, denominator):
    if not denominator:
        return None
    return round((numerator / denominator) * 100)


def delta(current, previous):
    difference = current - previous
    percent_change = round((difference / previous) * 100) if previous else None
    return {"difference": difference, "percent": percent_change}


def rate_delta(current, previous):
    if current is None or previous is None:
        return None
    return current - previous


def titleize(value):
    if not value:
        return ""
    return " ".join(word.capitalize() for word in str(value).split())


def parse_csv(value):
    if not value:
        return []
    return [item.strip() for item in str(value).split(",") if item.strip()]


def parse_date(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).date()
    except (TypeError, ValueError):
        return None


def parse_cost_basis(value):
    if not value:
        return 0
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0


def normalize_metric(metric):
    metric_map = {
        "averageDays": "average_days",
        "average_days_to_enroll": "average_days",
        "contributionMargin": "contribution_margin",
        "conversionRate": "conversion",
        "closeRate": "close",
        "touredRate": "toured",
    }
    return metric_map.get(metric, metric)


def build_period(date_from, date_to):
    if not date_from and not date_to:
        return {
            "selected": "All Time",
            "previous": "",
            "date_from": None,
            "date_to": None,
            "previous_date_from": None,
            "previous_date_to": None,
        }
    start = date_from or date_to
    end = date_to or date_from
    if start > end:
        start, end = end, start
    days = (end - start).days + 1
    previous_end = start - timedelta(days=1)
    previous_start = previous_end - timedelta(days=days - 1)
    return {
        "selected": f"{start:%B %-d, %Y} to {end:%B %-d, %Y}",
        "previous": f"{previous_start:%B %-d, %Y} to {previous_end:%B %-d, %Y}",
        "date_from": start,
        "date_to": end,
        "previous_date_from": previous_start,
        "previous_date_to": previous_end,
    }


def base_queryset(user):
    queryset = Tour.objects.select_related(
        "family", "location", "lead_source", "assigned_staff",
    ).prefetch_related("events")
    return filter_queryset_by_location(queryset, user)


def apply_filters(queryset, filters):
    location_ids = parse_csv(filters.get("location") or filters.get("locations"))
    lead_source_ids = parse_csv(filters.get("lead_source") or filters.get("leadSources"))
    statuses = parse_csv(filters.get("status") or filters.get("statuses"))
    staff_ids = parse_csv(filters.get("staff") or filters.get("assigned_staff") or filters.get("assignedStaff"))
    search = filters.get("search")
    if location_ids:
        queryset = queryset.filter(location_id__in=location_ids)
    if lead_source_ids:
        queryset = queryset.filter(lead_source_id__in=lead_source_ids)
    if statuses:
        queryset = queryset.filter(current_status__in=statuses)
    if staff_ids:
        queryset = queryset.filter(assigned_staff_id__in=staff_ids)
    if search:
        queryset = queryset.filter(family__family_name__icontains=search)
    return queryset
