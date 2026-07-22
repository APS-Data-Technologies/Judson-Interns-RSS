from collections import defaultdict
from datetime import datetime, timedelta
from math import ceil

from django.db.models import Sum
from django.utils import timezone

from apps.accounts.models import User
from apps.accounts.permissions import filter_queryset_by_location
from apps.reports.models import CostBasis
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


def build_financial_summary(user, query_params, start, end):
    queryset = filter_queryset_by_location(
        CostBasis.objects.filter(is_active=True),
        user,
    )
    location_ids = parse_csv(query_params.get("location") or query_params.get("locations"))
    if location_ids:
        queryset = queryset.filter(location_id__in=location_ids)
    staff_ids = parse_csv(
        query_params.get("staff")
        or query_params.get("assigned_staff")
        or query_params.get("assignedStaff")
    )
    if staff_ids:
        staff_location_ids = User.objects.filter(
            id__in=staff_ids,
            location_id__isnull=False,
        ).values_list("location_id", flat=True)
        queryset = queryset.filter(location_id__in=staff_location_ids)
    if start:
        queryset = queryset.filter(reporting_month__gte=start.replace(day=1))
    if end:
        queryset = queryset.filter(reporting_month__lte=end.replace(day=1))

    totals = {
        row["cost_type"]: row["total"] or 0
        for row in queryset.values("cost_type").annotate(total=Sum("cost_amount"))
    }
    revenue = totals.get(CostBasis.CostType.REVENUE, 0)
    cost = totals.get(CostBasis.CostType.EXPENDITURE, 0)
    return {
        "revenue": revenue,
        "cost": cost,
        "margin": revenue - cost,
    }


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


def volume_event_timestamp(tour, status):
    if status == "scheduled":
        return timezone.localtime(tour.created_at)
    status_map = {
        "toured": {TourStatus.TOURED},
        "no_show": {TourStatus.NO_SHOW},
        "enrolled": {TourStatus.ENROLLED},
        "churned": {TourStatus.CHURNED},
    }
    matching_dates = [
        event.event_timestamp
        for event in tour.events.all()
        if event.status in status_map[status] and event.event_timestamp
    ]
    if matching_dates:
        return timezone.localtime(min(matching_dates))
    if tour.current_status in status_map[status]:
        return timezone.localtime(tour.updated_at)
    return None


def volume_event_date(tour, status):
    timestamp = volume_event_timestamp(tour, status)
    return timestamp.date() if timestamp else None


PROGRESS_BUCKETS = (
    ("0–7 days", 0, 7),
    ("8–14 days", 8, 14),
    ("15–30 days", 15, 30),
    ("31–60 days", 31, 60),
    ("60+ days", 61, None),
)
SHORT_PROGRESS_BUCKETS = (
    ("0–2 days", 0, 2),
    ("3–5 days", 3, 5),
    ("6–10 days", 6, 10),
    ("11–20 days", 11, 20),
    ("21+ days", 21, None),
)


def build_time_to_progress(tours, previous_tours=None, buckets=PROGRESS_BUCKETS):
    transitions = (
        ("booked_to_toured", "Booked → Toured", "scheduled", "toured"),
        ("booked_to_no_show", "Booked → No Show", "scheduled", "no_show"),
        ("toured_to_enrolled", "Toured → Enrolled", "toured", "enrolled"),
        ("toured_to_churned", "Toured → Churned", "toured", "churned"),
        ("booked_to_enrolled", "Booked → Enrolled", "tour_date", "enrolled"),
    )
    result = []
    for key, label, source_status, destination_status in transitions:
        counts = [0 for _ in buckets]
        elapsed_values = []
        eligible = len(tours) if source_status in {"scheduled", "tour_date"} else sum(1 for tour in tours if reached_status(tour, TourStatus.TOURED))
        for tour in tours:
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
            elapsed_values.append(elapsed_days)
            for index, (_, minimum, maximum) in enumerate(buckets):
                if elapsed_days >= minimum and (maximum is None or elapsed_days <= maximum):
                    counts[index] += 1
                    break
        total = sum(counts)
        result.append({
            "key": key,
            "label": label,
            "total": total,
            "eligible": eligible,
            "pending": max(eligible - total, 0),
            "averageDays": round(sum(elapsed_values) / len(elapsed_values), 1) if elapsed_values else None,
            "buckets": [
                {
                    "label": bucket[0],
                    "count": counts[index],
                    "percent": round((counts[index] / total) * 100, 1) if total else 0,
                }
                for index, bucket in enumerate(buckets)
            ],
        })
    if previous_tours is not None:
        previous = {item["key"]: item for item in build_time_to_progress(previous_tours, buckets=buckets)}
        for item in result:
            previous_item = previous.get(item["key"], {})
            item["previousAverageDays"] = previous_item.get("averageDays")
            item["averageDelta"] = round(item["averageDays"] - item["previousAverageDays"], 1) if item["averageDays"] is not None and item["previousAverageDays"] is not None else None
    return result


def count_period_volume(tours, start, end):
    counts = {status: 0 for status in ("scheduled", "toured", "no_show", "enrolled", "churned")}
    for tour in tours:
        for status in counts:
            event_date = volume_event_date(tour, status)
            if event_date and (not start or event_date >= start) and (not end or event_date <= end):
                counts[status] += 1
    return counts


def build_volume_trend_data(tours, start, end):
    if not start or not end:
        dates = [
            event_date
            for tour in tours
            for status in ("scheduled", "toured", "no_show", "enrolled", "churned")
            if (event_date := volume_event_date(tour, status))
        ]
        if not dates:
            return []
        start, end = min(dates), max(dates)

    step = 7 if (end - start).days + 1 > 45 else 1
    rows = []
    bucket_start = start
    while bucket_start <= end:
        bucket_end = min(bucket_start + timedelta(days=step - 1), end)
        counts = count_period_volume(tours, bucket_start, bucket_end)
        rows.append({
            "date": bucket_start.isoformat(),
            "label": bucket_start.strftime("%b %-d") if step == 1 else f"{bucket_start:%b %-d} - {bucket_end:%b %-d}",
            "booked": counts["scheduled"],
            "toured": counts["toured"],
            "noShow": counts["no_show"],
            "enrolled": counts["enrolled"],
            "churned": counts["churned"],
        })
        bucket_start = bucket_end + timedelta(days=1)
    return rows


def build_volume_heatmap(tours, start, end):
    hours = range(8, 21)
    rows = {
        (day, hour): {
            "day": day,
            "hour": hour,
            "booked": 0,
            "toured": 0,
            "noShow": 0,
            "enrolled": 0,
            "churned": 0,
        }
        for day in range(7)
        for hour in hours
    }
    output_keys = {
        "scheduled": "booked",
        "toured": "toured",
        "no_show": "noShow",
        "enrolled": "enrolled",
        "churned": "churned",
    }
    for tour in tours:
        for status, output_key in output_keys.items():
            timestamp = volume_event_timestamp(tour, status)
            if not timestamp:
                continue
            event_date = timestamp.date()
            if start and event_date < start:
                continue
            if end and event_date > end:
                continue
            key = (timestamp.weekday(), timestamp.hour)
            if key in rows:
                rows[key][output_key] += 1
    return list(rows.values())


def build_volume_calendar_data(tours, start, end):
    dated_events = []
    for tour in tours:
        for status in ("scheduled", "toured", "no_show", "enrolled", "churned"):
            event_date = volume_event_date(tour, status)
            if event_date:
                dated_events.append((event_date, status))
    if not start or not end:
        if not dated_events:
            return []
        start = min(event_date for event_date, _ in dated_events)
        end = max(event_date for event_date, _ in dated_events)

    output_keys = {
        "scheduled": "booked",
        "toured": "toured",
        "no_show": "noShow",
        "enrolled": "enrolled",
        "churned": "churned",
    }
    rows = {}
    cursor = start
    while cursor <= end:
        rows[cursor] = {"date": cursor.isoformat(), **{key: 0 for key in output_keys.values()}}
        cursor += timedelta(days=1)
    for event_date, status in dated_events:
        if event_date in rows:
            rows[event_date][output_keys[status]] += 1
    return list(rows.values())


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

    rows = []
    bucket_start = start
    while bucket_start <= end:
        cohort = [tour for tour in tours if tour.scheduled_tour_date.date() == bucket_start]
        counts = count_cohort_progress(cohort)
        rates = build_rates(counts)
        average_days = average_days_to_enroll(cohort)
        average_days_count = sum(1 for tour in cohort if first_event_date(tour, {TourStatus.ENROLLED}))
        rows.append(
            {
                "date": bucket_start.isoformat(),
                "label": bucket_start.strftime("%b %-d"),
                "booked": counts["scheduled"],
                "toured": counts["toured"],
                "noShow": counts["no_show"],
                "enrolled": counts["enrolled"],
                "churned": counts["churned"],
                "touredRate": rates["toured"],
                "noShowRate": rates["noShow"],
                "closeRate": rates["close"],
                "conversionRate": rates["conversion"],
                "averageDaysToEnroll": average_days,
                "averageDaysCount": average_days_count,
            }
        )
        bucket_start += timedelta(days=1)
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
                "averageDaysToEnroll": counts["average_days"],
                "numerator": counts["enrolled"],
                "denominator": counts["toured"] if metric != "enrollments" else counts["scheduled"],
            }
        )
    return rows


def build_entity_health(
    all_tours,
    current_tours,
    previous_tours,
    start,
    end,
    previous_start,
    previous_end,
    group,
    related_groups=None,
):
    related_groups = related_groups or []
    all_groups = defaultdict(list)
    current_groups = defaultdict(list)
    previous_groups = defaultdict(list)
    for tour in all_tours:
        all_groups[group_label(tour, group)].append(tour)
    for tour in current_tours:
        current_groups[group_label(tour, group)].append(tour)
    for tour in previous_tours:
        previous_groups[group_label(tour, group)].append(tour)

    rows = []
    for name in sorted(set(all_groups) | set(current_groups) | set(previous_groups)):
        all_location_tours = all_groups[name]
        location_tours = current_groups[name]
        previous_location_tours = previous_groups[name]
        counts = count_cohort_progress(location_tours)
        previous_counts = count_cohort_progress(previous_location_tours)
        volume_counts = count_period_volume(all_location_tours, start, end)
        previous_volume_counts = count_period_volume(
            all_location_tours,
            previous_start,
            previous_end,
        ) if previous_start and previous_end else {status: 0 for status in volume_counts}
        average_days = average_days_to_enroll(location_tours)
        previous_average_days = average_days_to_enroll(previous_location_tours)
        location_pending = pending_counts(
            location_tours,
            average_days,
        )
        volume_trend = compress_volume_trend(
            build_volume_calendar_data(all_location_tours, start, end)
        )
        rate_trend = compress_rate_trend(build_trend_data(location_tours, start, end))
        best_timing = build_best_timing(
            all_location_tours,
            location_tours,
            start,
            end,
        )
        related_performance = {}
        for related_group in related_groups:
            related_all_groups = defaultdict(list)
            related_current_groups = defaultdict(list)
            for tour in all_location_tours:
                related_all_groups[group_label(tour, related_group)].append(tour)
            for tour in location_tours:
                related_current_groups[group_label(tour, related_group)].append(tour)
            related_rows = []
            for related_name in sorted(set(related_all_groups) | set(related_current_groups)):
                related_counts = count_cohort_progress(related_current_groups[related_name])
                related_volume = count_period_volume(
                    related_all_groups[related_name],
                    start,
                    end,
                )
                related_rows.append({
                    "name": related_name,
                    "volume": {
                        "booked": related_volume["scheduled"],
                        "toured": related_volume["toured"],
                        "noShow": related_volume["no_show"],
                        "enrolled": related_volume["enrolled"],
                        "churned": related_volume["churned"],
                    },
                    "booked": related_counts["scheduled"],
                    "toured": related_counts["toured"],
                    "noShow": related_counts["no_show"],
                    "enrolled": related_counts["enrolled"],
                    "churned": related_counts["churned"],
                    "averageDaysToEnroll": average_days_to_enroll(
                        related_current_groups[related_name]
                    ),
                })
            related_performance[related_group] = related_rows
        rows.append({
            "name": name,
            "hasPreviousPeriod": bool(previous_start and previous_end),
            "volume": {
                "booked": volume_counts["scheduled"],
                "toured": volume_counts["toured"],
                "noShow": volume_counts["no_show"],
                "enrolled": volume_counts["enrolled"],
                "churned": volume_counts["churned"],
            },
            "previousVolume": {
                "booked": previous_volume_counts["scheduled"],
                "toured": previous_volume_counts["toured"],
                "noShow": previous_volume_counts["no_show"],
                "enrolled": previous_volume_counts["enrolled"],
                "churned": previous_volume_counts["churned"],
            },
            "booked": counts["scheduled"],
            "toured": counts["toured"],
            "noShow": counts["no_show"],
            "enrolled": counts["enrolled"],
            "churned": counts["churned"],
            "previousBooked": previous_counts["scheduled"],
            "previousToured": previous_counts["toured"],
            "previousNoShow": previous_counts["no_show"],
            "previousEnrolled": previous_counts["enrolled"],
            "previousChurned": previous_counts["churned"],
            "averageDaysToEnroll": average_days,
            "previousAverageDaysToEnroll": previous_average_days,
            "pendingTourOutcome": location_pending["pendingTourOutcome"],
            "pendingEnrollmentOutcome": location_pending["pendingEnrollmentOutcome"],
            "volumeTrend": volume_trend,
            "rateTrend": rate_trend,
            "relatedPerformance": related_performance,
            "bestTiming": best_timing,
        })
    return rows


def timing_descriptors(value):
    return {
        "quarter": (str(((value.month - 1) // 3) + 1), f"Q{((value.month - 1) // 3) + 1}"),
        "month": (str(value.month), value.strftime("%B")),
        "weekOfMonth": (str(((value.day - 1) // 7) + 1), f"Week {((value.day - 1) // 7) + 1}"),
        "dayOfWeek": (str(value.weekday()), value.strftime("%A")),
    }


def best_timing_entries(rows, value_getter, qualifier=None):
    dimensions = ("quarter", "month", "weekOfMonth", "dayOfWeek")
    buckets = {dimension: {} for dimension in dimensions}
    for row in rows:
        value_date = datetime.fromisoformat(row["date"]).date()
        for dimension, (key, label) in timing_descriptors(value_date).items():
            bucket = buckets[dimension].setdefault(
                key,
                {"key": key, "label": label, "rows": []},
            )
            bucket["rows"].append(row)

    result = {}
    for dimension in dimensions:
        candidates = []
        for bucket in buckets[dimension].values():
            if qualifier and not qualifier(bucket["rows"]):
                continue
            candidates.append({
                "label": bucket["label"],
                "value": value_getter(bucket["rows"]),
            })
        result[dimension] = max(
            candidates,
            key=lambda item: (item["value"], item["label"]),
            default=None,
        )
    return result


def build_best_timing(all_tours, current_tours, start, end):
    volume_rows = build_volume_calendar_data(all_tours, start, end)
    rate_rows = build_trend_data(current_tours, start, end)
    return {
        "volume": best_timing_entries(
            volume_rows,
            lambda rows: sum(row["enrolled"] for row in rows),
            qualifier=lambda rows: sum(row["enrolled"] for row in rows) > 0,
        ),
        "rate": best_timing_entries(
            rate_rows,
            lambda rows: percent(
                sum(row["enrolled"] for row in rows),
                sum(row["toured"] for row in rows),
            ),
            qualifier=lambda rows: sum(row["toured"] for row in rows) > 0,
        ),
    }


def chunk_trend_rows(rows, maximum_points=12):
    if len(rows) <= maximum_points:
        return [[row] for row in rows]
    size = ceil(len(rows) / maximum_points)
    return [rows[index:index + size] for index in range(0, len(rows), size)]


def compress_volume_trend(rows):
    fields = ("booked", "toured", "noShow", "enrolled", "churned")
    return [
        {
            "date": chunk[-1]["date"],
            **{field: sum(row[field] for row in chunk) for field in fields},
        }
        for chunk in chunk_trend_rows(rows)
    ]


def compress_rate_trend(rows):
    compressed = []
    for chunk in chunk_trend_rows(rows):
        booked = sum(row["booked"] for row in chunk)
        toured = sum(row["toured"] for row in chunk)
        no_show = sum(row["noShow"] for row in chunk)
        enrolled = sum(row["enrolled"] for row in chunk)
        churned = sum(row["churned"] for row in chunk)
        average_count = sum(row["averageDaysCount"] for row in chunk)
        average_total = sum(
            (row["averageDaysToEnroll"] or 0) * row["averageDaysCount"]
            for row in chunk
        )
        compressed.append({
            "date": chunk[-1]["date"],
            "touredRate": percent(toured, booked),
            "conversionRate": percent(enrolled, toured),
            "noShowRate": percent(no_show, booked),
            "closeRate": percent(enrolled + churned, toured),
            "averageDaysToEnroll": round(average_total / average_count, 1) if average_count else None,
        })
    return compressed


def build_volume_performance_ranking(tours, group, start, end):
    grouped = defaultdict(list)
    for tour in tours:
        grouped[group_label(tour, group)].append(tour)

    rows = []
    for name, group_tours in grouped.items():
        counts = count_period_volume(group_tours, start, end)
        rows.append({
            "name": name,
            "all": sum(counts.values()),
            "booked": counts["scheduled"],
            "toured": counts["toured"],
            "noShow": counts["no_show"],
            "enrolled": counts["enrolled"],
            "churned": counts["churned"],
        })
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
    can_view_restricted_analytics = user.role in {"admin", "super_admin"}
    date_from = parse_date(query_params.get("date_from") or query_params.get("dateFrom"))
    date_to = parse_date(query_params.get("date_to") or query_params.get("dateTo"))
    period = build_period(date_from, date_to)
    progress_buckets = SHORT_PROGRESS_BUCKETS if date_from and date_to and ((date_to - date_from).days + 1) < 20 else PROGRESS_BUCKETS
    metric = normalize_metric(query_params.get("metric") or query_params.get("ranking_metric") or "conversion")
    ranking_sort = query_params.get("ranking_sort") or query_params.get("rankingSort") or "best"
    cost_basis = query_params.get("cost_basis") or query_params.get("costBasis")
    cost_basis = parse_cost_basis(cost_basis)

    scoped_queryset = base_queryset(user)
    staff_option_queryset = scoped_queryset
    option_location_ids = parse_csv(query_params.get("location") or query_params.get("locations"))
    if option_location_ids:
        staff_option_queryset = staff_option_queryset.filter(location_id__in=option_location_ids)
    staff_options = {}
    for tour in staff_option_queryset.exclude(assigned_staff__isnull=True):
        staff = tour.assigned_staff
        staff_options[staff.pk] = {
            "id": staff.pk,
            "name": titleize(staff.get_full_name() or staff.email),
            "locationId": tour.location_id,
        }

    queryset = apply_filters(scoped_queryset, query_params)
    all_tours = list(queryset.order_by("scheduled_tour_date", "family__family_name"))
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
    volume_counts = count_period_volume(all_tours, period["date_from"], period["date_to"])
    previous_volume_counts = count_period_volume(
        all_tours,
        period["previous_date_from"],
        period["previous_date_to"],
    ) if period["previous_date_from"] and period["previous_date_to"] else {status: 0 for status in volume_counts}

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
        ) if can_view_restricted_analytics else [],
    }
    all_time_rankings = {
        "locations": sort_ranking(build_ranking(all_tours, "location", metric, cost_basis), metric, ranking_sort),
        "leadSources": sort_ranking(build_ranking(all_tours, "lead_source", metric, cost_basis), metric, ranking_sort),
        "staff": sort_ranking(build_ranking(all_tours, "staff", metric, cost_basis), metric, ranking_sort) if can_view_restricted_analytics else [],
    }
    volume_performance_rankings = {
        "locations": build_volume_performance_ranking(all_tours, "location", period["date_from"], period["date_to"]),
        "leadSources": build_volume_performance_ranking(all_tours, "lead_source", period["date_from"], period["date_to"]),
        "staff": build_volume_performance_ranking(all_tours, "staff", period["date_from"], period["date_to"]) if can_view_restricted_analytics else [],
    }
    all_time_volume_performance_rankings = {
        "locations": build_volume_performance_ranking(all_tours, "location", None, None),
        "leadSources": build_volume_performance_ranking(all_tours, "lead_source", None, None),
        "staff": build_volume_performance_ranking(all_tours, "staff", None, None) if can_view_restricted_analytics else [],
    }

    return {
        "period": period,
        "financialSummary": build_financial_summary(
            user,
            query_params,
            period["date_from"],
            period["date_to"],
        ) if can_view_restricted_analytics else {"revenue": 0, "cost": 0, "margin": 0},
        "staffOptions": sorted(staff_options.values(), key=lambda item: item["name"]),
        "counts": counts,
        "volumeCounts": volume_counts,
        "previousVolumeCounts": previous_volume_counts,
        "volumeDeltas": {status: delta(volume_counts[status], previous_volume_counts[status]) for status in volume_counts},
        "previousCounts": previous_counts,
        "deltas": {status: delta(counts[status], previous_counts[status]) for status in counts},
        "rates": rates,
        "rateDeltas": {key: rate_delta(rates[key], previous_rates[key]) for key in rates},
        "averageDaysToEnroll": average_days,
        "pendingCounts": pending_counts(current_tours, average_days),
        "timeToProgress": build_time_to_progress(current_tours, previous_tours, progress_buckets),
        "trendData": build_trend_data(current_tours, period["date_from"], period["date_to"]),
        "allTimeTrendData": build_trend_data(all_tours, None, None),
        "volumeTrendData": build_volume_trend_data(all_tours, period["date_from"], period["date_to"]),
        "previousVolumeTrendData": build_volume_trend_data(
            all_tours,
            period["previous_date_from"],
            period["previous_date_to"],
        ) if period["previous_date_from"] and period["previous_date_to"] else [],
        "volumeHeatmap": build_volume_heatmap(all_tours, period["date_from"], period["date_to"]),
        "volumeCalendarData": build_volume_calendar_data(all_tours, period["date_from"], period["date_to"]),
        "allTimeVolumeCalendarData": build_volume_calendar_data(all_tours, None, None),
        "rankings": rankings,
        "allTimeRankings": all_time_rankings,
        "volumePerformanceRankings": volume_performance_rankings,
        "allTimeVolumePerformanceRankings": all_time_volume_performance_rankings,
        "entityHealth": {
            "locations": build_entity_health(
                all_tours,
                current_tours,
                previous_tours,
                period["date_from"],
                period["date_to"],
                period["previous_date_from"],
                period["previous_date_to"],
                "location",
                ("lead_source", "staff"),
            ),
            "leadSources": build_entity_health(
                all_tours,
                current_tours,
                previous_tours,
                period["date_from"],
                period["date_to"],
                period["previous_date_from"],
                period["previous_date_to"],
                "lead_source",
                ("location",),
            ),
            "staff": build_entity_health(
                all_tours,
                current_tours,
                previous_tours,
                period["date_from"],
                period["date_to"],
                period["previous_date_from"],
                period["previous_date_to"],
                "staff",
            ) if can_view_restricted_analytics else [],
        },
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
