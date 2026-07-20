from collections import defaultdict
from datetime import datetime, timedelta

from django.utils import timezone

from apps.accounts.permissions import filter_queryset_by_location
from apps.tours.models import Tour, TourStatus


BOOKED_STATUSES = {
    TourStatus.SCHEDULED,
    TourStatus.RESCHEDULED,
    TourStatus.TOURED,
    TourStatus.ENROLLED,
    TourStatus.CHURNED,
    TourStatus.NO_SHOW,
    TourStatus.CANCELLED,
}
TOURED_STATUSES = {TourStatus.TOURED, TourStatus.ENROLLED, TourStatus.CHURNED}


def percent(numerator, denominator):
    if not denominator:
        return None
    return round((numerator / denominator) * 100)


def delta(current, previous):
    difference = current - previous
    percent_change = None
    if previous:
        percent_change = round((difference / previous) * 100)
    return {
        "difference": difference,
        "percent": percent_change,
    }


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
        "family",
        "location",
        "lead_source",
        "assigned_staff",
    ).prefetch_related("events")
    return filter_queryset_by_location(queryset, user)


def apply_filters(queryset, filters):
    location_ids = parse_csv(filters.get("location") or filters.get("locations"))
    lead_source_ids = parse_csv(filters.get("lead_source") or filters.get("leadSources"))
    statuses = parse_csv(filters.get("status") or filters.get("statuses"))
    search = filters.get("search")

    if location_ids:
        queryset = queryset.filter(location_id__in=location_ids)
    if lead_source_ids:
        queryset = queryset.filter(lead_source_id__in=lead_source_ids)
    if statuses:
        queryset = queryset.filter(current_status__in=statuses)
    if search:
        queryset = queryset.filter(family__family_name__icontains=search)
    return queryset


def filter_by_scheduled_period(queryset, start, end):
    if start:
        queryset = queryset.filter(scheduled_tour_date__date__gte=start)
    if end:
        queryset = queryset.filter(scheduled_tour_date__date__lte=end)
    return queryset


def event_statuses(tour):
    return {event.status for event in tour.events.all()}


def first_event_date(tour, statuses):
    matching_dates = [
        event.event_timestamp.date()
        for event in tour.events.all()
        if event.status in statuses and event.event_timestamp
    ]
    if matching_dates:
        return min(matching_dates)
    if tour.current_status in statuses:
        return tour.updated_at.date()
    return None


def reached_status(tour, status):
    statuses = event_statuses(tour)
    if status == TourStatus.SCHEDULED:
        return tour.current_status in BOOKED_STATUSES
    if status == TourStatus.TOURED:
        return tour.current_status in TOURED_STATUSES or bool(statuses.intersection(TOURED_STATUSES))
    if status == TourStatus.NO_SHOW:
        return tour.current_status == TourStatus.NO_SHOW or TourStatus.NO_SHOW in statuses
    if status == TourStatus.ENROLLED:
        return tour.current_status == TourStatus.ENROLLED or TourStatus.ENROLLED in statuses
    if status == TourStatus.CHURNED:
        return tour.current_status == TourStatus.CHURNED or TourStatus.CHURNED in statuses
    return False


def count_cohort_progress(tours):
    return {
        "scheduled": len(tours),
        "toured": sum(1 for tour in tours if reached_status(tour, TourStatus.TOURED)),
        "no_show": sum(1 for tour in tours if reached_status(tour, TourStatus.NO_SHOW)),
        "enrolled": sum(1 for tour in tours if reached_status(tour, TourStatus.ENROLLED)),
        "churned": sum(1 for tour in tours if reached_status(tour, TourStatus.CHURNED)),
    }


def build_rates(counts):
    return {
        "toured": percent(counts["toured"], counts["scheduled"]),
        "noShow": percent(counts["no_show"], counts["scheduled"]),
        "close": percent(counts["enrolled"] + counts["churned"], counts["toured"]),
        "conversion": percent(counts["enrolled"], counts["toured"]),
    }


def average_days_to_enroll(tours):
    days = []
    for tour in tours:
        enrolled_date = first_event_date(tour, {TourStatus.ENROLLED})
        if enrolled_date:
            days.append((enrolled_date - tour.scheduled_tour_date.date()).days)
    if not days:
        return None
    return round(sum(days) / len(days), 1)


def pending_counts(tours, average_days):
    today = timezone.localdate()
    pending_tour_outcome = 0
    pending_enrollment_outcome = 0

    for tour in tours:
        tour_date = tour.scheduled_tour_date.date()
        if (
            tour.current_status in {TourStatus.SCHEDULED, TourStatus.RESCHEDULED}
            and tour_date < today
            and not reached_status(tour, TourStatus.TOURED)
            and not reached_status(tour, TourStatus.NO_SHOW)
        ):
            pending_tour_outcome += 1

        if average_days is not None:
            reached_toured = reached_status(tour, TourStatus.TOURED)
            has_final_outcome = reached_status(tour, TourStatus.ENROLLED) or reached_status(
                tour, TourStatus.CHURNED
            )
            days_since_tour = (today - tour_date).days
            if reached_toured and not has_final_outcome and days_since_tour > average_days:
                pending_enrollment_outcome += 1

    return {
        "pendingTourOutcome": pending_tour_outcome,
        "pendingEnrollmentOutcome": pending_enrollment_outcome,
    }


def metric_date(tour, metric):
    if metric == "booked":
        return tour.scheduled_tour_date.date()
    if metric == "toured":
        return first_event_date(tour, {TourStatus.TOURED, TourStatus.ENROLLED, TourStatus.CHURNED})
    if metric == "enrolled":
        return first_event_date(tour, {TourStatus.ENROLLED})
    return None


def build_trend_data(tours, start, end):
    if not start or not end:
        dates = [tour.scheduled_tour_date.date() for tour in tours]
        if not dates:
            return []
        start = min(dates)
        end = max(dates)

    bucket_count = (end - start).days + 1
    if bucket_count > 45:
        step = 7
    else:
        step = 1

    buckets = []
    bucket_start = start
    while bucket_start <= end:
        bucket_end = min(bucket_start + timedelta(days=step - 1), end)
        buckets.append((bucket_start, bucket_end))
        bucket_start = bucket_end + timedelta(days=1)

    rows = []
    for bucket_start, bucket_end in buckets:
        booked = 0
        toured = 0
        enrolled = 0
        for tour in tours:
            if bucket_start <= tour.scheduled_tour_date.date() <= bucket_end:
                booked += 1
            toured_date = metric_date(tour, "toured")
            if toured_date and bucket_start <= toured_date <= bucket_end:
                toured += 1
            enrolled_date = metric_date(tour, "enrolled")
            if enrolled_date and bucket_start <= enrolled_date <= bucket_end:
                enrolled += 1

        if step == 1:
            label = bucket_start.strftime("%b %-d")
        else:
            label = f"{bucket_start:%b %-d} - {bucket_end:%b %-d}"
        rows.append(
            {
                "date": bucket_start.isoformat(),
                "label": label,
                "booked": booked,
                "toured": toured,
                "enrolled": enrolled,
                "conversionRate": percent(enrolled, toured),
            }
        )
    return rows


def group_label(tour, group):
    if group == "location":
        return titleize(getattr(tour.location, "location_name", None)) or "Unknown Location"
    if group == "lead_source":
        return titleize(getattr(tour.lead_source, "source_name", None)) or "Unknown Source"
    if group == "staff":
        if not tour.assigned_staff:
            return "Unassigned Staff"
        return titleize(tour.assigned_staff.get_full_name() or tour.assigned_staff.email)
    return "Unknown"


def ranking_value(counts, metric, cost_basis):
    if metric == "close":
        return percent(counts["enrolled"] + counts["churned"], counts["toured"])
    if metric == "toured":
        return percent(counts["toured"], counts["scheduled"])
    if metric == "enrollments":
        return counts["enrolled"]
    if metric == "average_days":
        return counts.get("average_days")
    if metric == "contribution_margin":
        if not cost_basis:
            return 0
        return round(counts["enrolled"] * cost_basis, 2)
    return percent(counts["enrolled"], counts["toured"])


def build_ranking(tours, group, metric, cost_basis):
    grouped = defaultdict(list)
    for tour in tours:
        grouped[group_label(tour, group)].append(tour)

    rows = []
    for name, group_tours in grouped.items():
        counts = count_cohort_progress(group_tours)
        counts["average_days"] = average_days_to_enroll(group_tours)
        value = ranking_value(counts, metric, cost_basis)
        rows.append(
            {
                "name": name,
                "value": value,
                "scheduled": counts["scheduled"],
                "booked": counts["scheduled"],
                "toured": counts["toured"],
                "noShow": counts["no_show"],
                "enrolled": counts["enrolled"],
                "churned": counts["churned"],
                "numerator": counts["enrolled"],
                "denominator": counts["toured"] if metric != "enrollments" else counts["scheduled"],
            }
        )
    return rows


def sort_ranking(rows, metric, sort_direction):
    reverse = sort_direction != "least"
    if metric == "average_days":
        reverse = sort_direction == "least"

    def key(row):
        value = row["value"]
        if value is None:
            return -1 if reverse else 10**9
        return value

    return sorted(rows, key=key, reverse=reverse)


def cohort_analytics(user, query_params):
    date_from = parse_date(query_params.get("date_from") or query_params.get("dateFrom"))
    date_to = parse_date(query_params.get("date_to") or query_params.get("dateTo"))
    period = build_period(date_from, date_to)
    metric = normalize_metric(query_params.get("metric") or query_params.get("ranking_metric") or "conversion")
    ranking_sort = query_params.get("ranking_sort") or query_params.get("rankingSort") or "best"
    cost_basis = query_params.get("cost_basis") or query_params.get("costBasis")
    cost_basis = parse_cost_basis(cost_basis)

    queryset = apply_filters(base_queryset(user), query_params)
    selected_queryset = filter_by_scheduled_period(
        queryset,
        period["date_from"],
        period["date_to"],
    )
    previous_queryset = queryset.none()
    if period["previous_date_from"] and period["previous_date_to"]:
        previous_queryset = filter_by_scheduled_period(
            queryset,
            period["previous_date_from"],
            period["previous_date_to"],
        )

    current_tours = list(selected_queryset.order_by("scheduled_tour_date", "family__family_name"))
    previous_tours = list(previous_queryset.order_by("scheduled_tour_date", "family__family_name"))

    category_values = parse_csv(query_params.get("category") or query_params.get("categories"))
    if category_values:
        current_average_days = average_days_to_enroll(current_tours)
        previous_average_days = average_days_to_enroll(previous_tours)
        current_tours = filter_category(current_tours, category_values, current_average_days)
        previous_tours = filter_category(previous_tours, category_values, previous_average_days)

    counts = count_cohort_progress(current_tours)
    previous_counts = count_cohort_progress(previous_tours)
    rates = build_rates(counts)
    previous_rates = build_rates(previous_counts)
    average_days = average_days_to_enroll(current_tours)

    rankings = {
        "locations": sort_ranking(
            build_ranking(current_tours, "location", metric, cost_basis),
            metric,
            ranking_sort,
        ),
        "leadSources": sort_ranking(
            build_ranking(current_tours, "lead_source", metric, cost_basis),
            metric,
            ranking_sort,
        ),
        "staff": sort_ranking(
            build_ranking(current_tours, "staff", metric, cost_basis),
            metric,
            ranking_sort,
        ),
    }

    return {
        "period": period,
        "counts": counts,
        "previousCounts": previous_counts,
        "deltas": {status: delta(counts[status], previous_counts[status]) for status in counts},
        "rates": rates,
        "rateDeltas": {key: rate_delta(rates[key], previous_rates[key]) for key in rates},
        "averageDaysToEnroll": average_days,
        "pendingCounts": pending_counts(current_tours, average_days),
        "trendData": build_trend_data(current_tours, period["date_from"], period["date_to"]),
        "rankings": rankings,
    }


def filter_category(tours, categories, average_days):
    if "off_track" not in categories and "on_track" not in categories:
        return tours

    today = timezone.localdate()
    filtered = []
    for tour in tours:
        tour_date = tour.scheduled_tour_date.date()
        is_tour_outcome_pending = (
            tour.current_status in {TourStatus.SCHEDULED, TourStatus.RESCHEDULED}
            and tour_date < today
            and not reached_status(tour, TourStatus.TOURED)
            and not reached_status(tour, TourStatus.NO_SHOW)
        )
        is_final_outcome_pending = False
        if average_days is not None:
            is_final_outcome_pending = (
                reached_status(tour, TourStatus.TOURED)
                and not reached_status(tour, TourStatus.ENROLLED)
                and not reached_status(tour, TourStatus.CHURNED)
                and (today - tour_date).days > average_days
            )
        is_off_track = is_tour_outcome_pending or is_final_outcome_pending
        if ("off_track" in categories and is_off_track) or ("on_track" in categories and not is_off_track):
            filtered.append(tour)
    return filtered
