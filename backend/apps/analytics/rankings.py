from collections import defaultdict
from datetime import datetime
from math import ceil

from .core import percent, titleize
from .metrics import (
    average_days_to_enroll,
    build_rates,
    build_trend_data,
    build_volume_calendar_data,
    count_cohort_progress,
    count_period_volume,
    pending_counts,
)


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
