from datetime import timedelta

from django.utils import timezone

from apps.tours.models import TourStatus

from .core import percent


BOOKED_STATUSES = {
    TourStatus.SCHEDULED,
    TourStatus.TOURED,
    TourStatus.ENROLLED,
    TourStatus.CHURNED,
    TourStatus.NO_SHOW,
}
TOURED_STATUSES = {TourStatus.TOURED, TourStatus.ENROLLED, TourStatus.CHURNED}


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
            tour.current_status == TourStatus.SCHEDULED
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
