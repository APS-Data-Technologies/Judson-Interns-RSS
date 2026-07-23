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


def build_financial_trend(user, query_params, start, end):
    if not start or not end:
        return []

    queryset = filter_queryset_by_location(
        CostBasis.objects.filter(is_active=True),
        user,
    )
    location_ids = parse_csv(query_params.get("location") or query_params.get("locations"))
    if location_ids:
        queryset = queryset.filter(location_id__in=location_ids)
    queryset = queryset.filter(
        reporting_month__gte=start.replace(day=1),
        reporting_month__lte=end.replace(day=1),
    )
    totals = {
        (row["reporting_month"], row["cost_type"]): row["total"] or 0
        for row in queryset.values("reporting_month", "cost_type").annotate(total=Sum("cost_amount"))
    }

    rows = []
    month = start.replace(day=1)
    final_month = end.replace(day=1)
    while month <= final_month:
        revenue = totals.get((month, CostBasis.CostType.REVENUE), 0)
        cost = totals.get((month, CostBasis.CostType.EXPENDITURE), 0)
        margin = revenue - cost
        rows.append({
            "month": month.strftime("%Y-%m"),
            "revenue": revenue,
            "cost": cost,
            "margin": margin,
            "marginRate": round((margin / revenue) * 100, 2) if revenue else None,
            "hasRevenue": (month, CostBasis.CostType.REVENUE) in totals,
            "hasCost": (month, CostBasis.CostType.EXPENDITURE) in totals,
        })
        month = (month.replace(day=28) + timedelta(days=4)).replace(day=1)
    return rows


def build_cost_efficiency_trend(tours, financial_trend):
    rows = []
    for financial_row in financial_trend:
        month_start = datetime.strptime(financial_row["month"], "%Y-%m").date().replace(day=1)
        month_end = (month_start.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
        counts = count_period_volume(tours, month_start, month_end)
        cost = financial_row["cost"]
        rows.append({
            "month": financial_row["month"],
            "booked": counts["scheduled"],
            "toured": counts["toured"],
            "enrolled": counts["enrolled"],
            "costPerBooked": round(cost / counts["scheduled"], 2) if counts["scheduled"] else None,
            "costPerToured": round(cost / counts["toured"], 2) if counts["toured"] else None,
            "costPerEnrollment": round(cost / counts["enrolled"], 2) if counts["enrolled"] else None,
        })
    return rows


def build_location_financial_performance(user, query_params, start, end, tours):
    if not start or not end:
        return []
    queryset = filter_queryset_by_location(CostBasis.objects.filter(is_active=True), user)
    location_ids = parse_csv(query_params.get("location") or query_params.get("locations"))
    if location_ids:
        queryset = queryset.filter(location_id__in=location_ids)
    queryset = queryset.filter(
        reporting_month__gte=start.replace(day=1),
        reporting_month__lte=end.replace(day=1),
    )
    financials = defaultdict(lambda: {"revenue": 0, "cost": 0})
    names = {}
    for row in queryset.values("location_id", "location__location_name", "cost_type").annotate(total=Sum("cost_amount")):
        location_id = row["location_id"]
        names[location_id] = row["location__location_name"]
        if row["cost_type"] == CostBasis.CostType.REVENUE:
            financials[location_id]["revenue"] = row["total"] or 0
        elif row["cost_type"] == CostBasis.CostType.EXPENDITURE:
            financials[location_id]["cost"] = row["total"] or 0

    tours_by_location = defaultdict(list)
    for tour in tours:
        tours_by_location[tour.location_id].append(tour)

    rows = []
    for location_id, totals in financials.items():
        counts = count_period_volume(tours_by_location[location_id], start, end)
        cohort_tours = [
            tour for tour in tours_by_location[location_id]
            if start <= timezone.localtime(tour.scheduled_tour_date).date() <= end
        ]
        cohort_rates = build_rates(count_cohort_progress(cohort_tours))
        margin = totals["revenue"] - totals["cost"]
        rows.append({
            "locationId": location_id,
            "locationName": names[location_id],
            "revenue": totals["revenue"],
            "cost": totals["cost"],
            "margin": margin,
            "marginRate": round((margin / totals["revenue"]) * 100, 2) if totals["revenue"] else None,
            "booked": counts["scheduled"],
            "toured": counts["toured"],
            "enrolled": counts["enrolled"],
            "conversionRate": cohort_rates["conversion"],
            "costPerBooked": round(totals["cost"] / counts["scheduled"], 2) if counts["scheduled"] else None,
            "costPerToured": round(totals["cost"] / counts["toured"], 2) if counts["toured"] else None,
            "costPerEnrollment": round(totals["cost"] / counts["enrolled"], 2) if counts["enrolled"] else None,
        })
    return sorted(rows, key=lambda row: row["locationName"])


def format_money(value):
    return f"${value:,.0f}"


def change_percent(current, comparison):
    if not comparison:
        return None
    return round(((current - comparison) / abs(comparison)) * 100, 1)


def build_costs_margin_executive_brief(
    current_summary,
    comparison_summary,
    current_counts,
    comparison_counts,
    current_rates,
    comparison_rates,
    financial_trend,
    location_rows,
):
    revenue = current_summary["revenue"]
    cost = current_summary["cost"]
    margin = current_summary["margin"]
    margin_rate = round((margin / revenue) * 100, 1) if revenue else None
    comparison_margin = comparison_summary["margin"]
    margin_change = change_percent(margin, comparison_margin)
    revenue_change = change_percent(revenue, comparison_summary["revenue"])
    cost_change = change_percent(cost, comparison_summary["cost"])
    enrolled = current_counts["enrolled"]
    comparison_enrolled = comparison_counts["enrolled"]
    cost_per_enrollment = round(cost / enrolled, 2) if enrolled else None
    comparison_cost_per_enrollment = (
        round(comparison_summary["cost"] / comparison_enrolled, 2)
        if comparison_enrolled else None
    )

    key_figures = [
        {"label": "Revenue", "value": format_money(revenue)},
        {"label": "Costs", "value": format_money(cost)},
        {"label": "Contribution Margin", "value": format_money(margin)},
        {"label": "Margin %", "value": f"{margin_rate:.1f}%" if margin_rate is not None else "—"},
        {"label": "Cost / Enrollment", "value": format_money(cost_per_enrollment) if cost_per_enrollment is not None else "—"},
    ]
    working = []
    attention = []
    actions = []
    alerts = []

    if margin > 0:
        working.append(f"The selected period produced {format_money(margin)} in contribution margin at a {margin_rate:.1f}% margin.")
    if margin_change is not None and margin_change >= 5 and abs(margin - comparison_margin) >= 1000:
        working.append(f"Contribution margin improved {margin_change:.1f}% ({format_money(margin - comparison_margin)}) versus the comparison period.")
    if (
        cost_per_enrollment is not None
        and comparison_cost_per_enrollment is not None
        and enrolled >= 5
        and comparison_enrolled >= 5
    ):
        efficiency_change = change_percent(cost_per_enrollment, comparison_cost_per_enrollment)
        if efficiency_change is not None and efficiency_change <= -10:
            working.append(f"Cost per enrollment improved {abs(efficiency_change):.1f}% to {format_money(cost_per_enrollment)}.")
        elif efficiency_change is not None and efficiency_change >= 10:
            attention.append(f"Cost per enrollment worsened {efficiency_change:.1f}% to {format_money(cost_per_enrollment)}.")
            actions.append("Review locations with rising cost per enrollment before increasing spending.")

    if margin_change is not None and margin_change <= -5 and abs(margin - comparison_margin) >= 1000:
        attention.append(f"Contribution margin declined {abs(margin_change):.1f}% ({format_money(abs(margin - comparison_margin))}) versus the comparison period.")
    if revenue_change is not None and cost_change is not None and cost_change - revenue_change >= 5:
        attention.append(f"Costs grew {cost_change:.1f}% while revenue changed {revenue_change:.1f}%, compressing financial efficiency.")
        actions.append("Prioritize cost control where spending growth is outpacing revenue growth.")
    enrollment_change = change_percent(enrolled, comparison_enrolled)
    if enrollment_change is not None and comparison_enrolled >= 5 and enrollment_change <= -10:
        attention.append(f"Enrollments fell {abs(enrollment_change):.1f}% to {enrolled}, weakening cost efficiency.")
        actions.append("Investigate the locations contributing most to the enrollment decline.")

    if current_counts["toured"] >= 10 and comparison_counts["toured"] >= 10:
        conversion_change = current_rates["conversion"] - comparison_rates["conversion"]
        if conversion_change >= 5:
            working.append(f"Conversion improved {conversion_change:.1f} percentage points to {current_rates['conversion']:.1f}%.")
        elif conversion_change <= -5:
            attention.append(f"Conversion declined {abs(conversion_change):.1f} percentage points to {current_rates['conversion']:.1f}%.")

    if len(location_rows) > 1:
        top_margin = max(location_rows, key=lambda row: row["margin"])
        eligible_conversion = [row for row in location_rows if row["toured"] >= 10]
        if eligible_conversion:
            top_conversion = max(eligible_conversion, key=lambda row: row["conversionRate"])
            if top_margin["locationId"] != top_conversion["locationId"]:
                attention.append(
                    f"{top_margin['locationName']} leads margin, while {top_conversion['locationName']} leads conversion; scale and funnel quality are concentrated in different locations."
                )

    missing_months = [
        row["month"] for row in financial_trend
        if not row["hasRevenue"] or not row["hasCost"]
    ]
    negative_months = [row for row in financial_trend if row["margin"] < 0]
    if missing_months:
        alerts.append(f"Financial records are incomplete for {len(missing_months)} selected month{'s' if len(missing_months) != 1 else ''}; conclusions may be understated.")
    if margin < 0:
        alerts.append(f"Contribution margin is negative by {format_money(abs(margin))} for the selected period.")
    if len(negative_months) >= 2:
        alerts.append(f"{len(negative_months)} selected months recorded negative contribution margin.")

    sections = []
    for key, title, items in (
        ("working", "What’s Working", working[:3]),
        ("attention", "Needs Attention", attention[:3]),
        ("actions", "Recommended Actions", actions[:2]),
        ("alerts", "Critical Alerts", alerts[:2]),
    ):
        if items:
            sections.append({"key": key, "title": title, "items": items})
    return {"keyFigures": key_figures, "sections": sections}


def structured_brief(key_figures, working=None, attention=None, actions=None, alerts=None):
    sections = []
    for key, title, items, limit in (
        ("working", "What’s Working", working or [], 3),
        ("attention", "Needs Attention", attention or [], 3),
        ("actions", "Recommended Actions", actions or [], 2),
        ("alerts", "Critical Alerts", alerts or [], 2),
    ):
        if items:
            sections.append({"key": key, "title": title, "items": items[:limit]})
    return {"keyFigures": key_figures, "sections": sections}


def build_volume_executive_brief(current, comparison, location_rows):
    labels = {
        "scheduled": "Booked",
        "toured": "Toured",
        "no_show": "No Show",
        "enrolled": "Enrolled",
        "churned": "Churned",
    }
    key_figures = [
        {"label": label, "value": f"{current[key]:,}"}
        for key, label in labels.items()
    ]
    working, attention, actions = [], [], []
    favorable_up = {"scheduled", "toured", "enrolled"}
    for key, label in labels.items():
        previous = comparison[key]
        change = change_percent(current[key], previous)
        if change is None or previous < 5 or abs(change) < 10:
            continue
        message = f"{label} {'increased' if change > 0 else 'decreased'} {abs(change):.1f}% to {current[key]:,}."
        favorable = (key in favorable_up and change > 0) or (key not in favorable_up and change < 0)
        (working if favorable else attention).append(message)
    eligible_locations = [row for row in location_rows if row["enrolled"] > 0]
    if eligible_locations:
        leader = max(eligible_locations, key=lambda row: row["enrolled"])
        working.append(f"{leader['name']} generated the most enrollment volume with {leader['enrolled']:,} enrollments.")
    if current["scheduled"] and current["enrolled"] < comparison["enrolled"] and current["scheduled"] >= comparison["scheduled"]:
        actions.append("Investigate downstream follow-up because booking volume held while enrollments declined.")
    if current["no_show"] > comparison["no_show"] and comparison["no_show"] >= 5:
        actions.append("Prioritize no-show reduction in the entities contributing most to the increase.")
    return structured_brief(key_figures, working, attention, actions)


def build_cohort_executive_brief(counts, previous_counts, rates, previous_rates, average_days, previous_average_days, pending):
    def rate_value(key):
        return f"{rates[key]:.1f}%" if rates[key] is not None else "—"

    key_figures = [
        {"label": "Toured Rate", "value": rate_value("toured")},
        {"label": "Conversion Rate", "value": rate_value("conversion")},
        {"label": "No Show Rate", "value": rate_value("noShow")},
        {"label": "Close Rate", "value": rate_value("close")},
        {"label": "Avg. Days to Enroll", "value": f"{average_days:.1f}" if average_days is not None else "—"},
    ]
    working, attention, actions, alerts = [], [], [], []
    if counts["scheduled"] >= 10 and previous_counts["scheduled"] >= 10:
        for key, label, favorable_up in (
            ("toured", "Toured rate", True),
            ("conversion", "Conversion rate", True),
            ("noShow", "No-show rate", False),
            ("close", "Close rate", True),
        ):
            if rates[key] is None or previous_rates[key] is None:
                continue
            change = rates[key] - previous_rates[key]
            if abs(change) < 5:
                continue
            message = f"{label} {'improved' if (change > 0) == favorable_up else 'worsened'} {abs(change):.1f} percentage points to {rates[key]:.1f}%."
            ((working if (change > 0) == favorable_up else attention)).append(message)
    if average_days is not None and previous_average_days is not None and abs(average_days - previous_average_days) >= 2:
        difference = average_days - previous_average_days
        message = f"Enrollment time {'shortened' if difference < 0 else 'lengthened'} by {abs(difference):.1f} days to {average_days:.1f} days."
        (working if difference < 0 else attention).append(message)
    if pending["pendingTourOutcome"]:
        attention.append(f"{pending['pendingTourOutcome']:,} past tours still need a tour outcome.")
    if pending["pendingEnrollmentOutcome"]:
        alerts.append(f"{pending['pendingEnrollmentOutcome']:,} toured families are beyond the expected enrollment follow-up window.")
        actions.append("Prioritize overdue enrollment follow-up before adding more pipeline volume.")
    return structured_brief(key_figures, working, attention, actions, alerts)


def build_entity_executive_brief(rows, entity_label):
    total_booked = sum(row["volume"]["booked"] for row in rows)
    total_enrolled = sum(row["volume"]["enrolled"] for row in rows)
    pending = sum(row["pendingTourOutcome"] + row["pendingEnrollmentOutcome"] for row in rows)
    eligible = [row for row in rows if row["toured"] >= 10]
    best = max(eligible, key=lambda row: percent(row["enrolled"], row["toured"]), default=None)
    best_rate = percent(best["enrolled"], best["toured"]) if best else None
    key_figures = [
        {"label": entity_label, "value": f"{len(rows):,}"},
        {"label": "Booked", "value": f"{total_booked:,}"},
        {"label": "Enrolled", "value": f"{total_enrolled:,}"},
        {"label": "Best Conversion", "value": f"{best_rate:.1f}%" if best_rate is not None else "—"},
        {"label": "Pending Outcomes", "value": f"{pending:,}"},
    ]
    working, attention, actions, alerts = [], [], [], []
    if best:
        working.append(f"{best['name']} leads qualified conversion at {best_rate:.1f}% from {best['toured']:,} toured families.")
    volume_leader = max(rows, key=lambda row: row["volume"]["enrolled"], default=None)
    if volume_leader and volume_leader["volume"]["enrolled"]:
        working.append(f"{volume_leader['name']} generated the most enrollment volume with {volume_leader['volume']['enrolled']:,} enrollments.")
    declining = []
    for row in rows:
        if row["toured"] < 10 or row["previousToured"] < 10:
            continue
        change = percent(row["enrolled"], row["toured"]) - percent(row["previousEnrolled"], row["previousToured"])
        if change <= -5:
            declining.append((change, row))
    if declining:
        change, row = min(declining, key=lambda item: item[0])
        attention.append(f"{row['name']} conversion declined {abs(change):.1f} percentage points versus the comparison period.")
        actions.append(f"Review follow-up performance for {row['name']} before shifting additional volume there.")
    pending_leader = max(rows, key=lambda row: row["pendingTourOutcome"] + row["pendingEnrollmentOutcome"], default=None)
    if pending_leader:
        pending_count = pending_leader["pendingTourOutcome"] + pending_leader["pendingEnrollmentOutcome"]
        if pending_count:
            alerts.append(f"{pending_leader['name']} has the highest unresolved follow-up load with {pending_count:,} pending outcomes.")
    return structured_brief(key_figures, working, attention, actions, alerts)


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
    pending_summary = pending_counts(current_tours, average_days)
    entity_health = {
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
    }
    executive_briefs = {
        "volume": build_volume_executive_brief(
            volume_counts,
            previous_volume_counts,
            volume_performance_rankings["locations"],
        ),
        "cohort": build_cohort_executive_brief(
            counts,
            previous_counts,
            rates,
            previous_rates,
            average_days,
            average_days_to_enroll(previous_tours),
            pending_summary,
        ),
        "locations": build_entity_executive_brief(entity_health["locations"], "Locations"),
        "leadSources": build_entity_executive_brief(entity_health["leadSources"], "Lead Sources"),
        "staff": build_entity_executive_brief(entity_health["staff"], "Staff Members") if can_view_restricted_analytics else {"keyFigures": [], "sections": []},
    }

    financial_trend = build_financial_trend(
        user,
        query_params,
        period["date_from"],
        period["date_to"],
    ) if can_view_restricted_analytics else []
    financial_summary = build_financial_summary(
        user,
        query_params,
        period["date_from"],
        period["date_to"],
    ) if can_view_restricted_analytics else {"revenue": 0, "cost": 0, "margin": 0}
    location_financial_performance = build_location_financial_performance(
        user,
        query_params,
        period["date_from"],
        period["date_to"],
        all_tours,
    ) if can_view_restricted_analytics else []
    comparison_from = parse_date(query_params.get("comparison_date_from") or query_params.get("comparisonDateFrom"))
    comparison_to = parse_date(query_params.get("comparison_date_to") or query_params.get("comparisonDateTo"))
    if not comparison_from or not comparison_to:
        comparison_from = period["previous_date_from"]
        comparison_to = period["previous_date_to"]
    executive_brief = {"keyFigures": [], "sections": []}
    if can_view_restricted_analytics and comparison_from and comparison_to:
        comparison_summary = build_financial_summary(
            user, query_params, comparison_from, comparison_to
        )
        comparison_volume_counts = count_period_volume(
            all_tours, comparison_from, comparison_to
        )
        comparison_cohort_tours = [
            tour for tour in all_tours
            if comparison_from <= timezone.localtime(tour.scheduled_tour_date).date() <= comparison_to
        ]
        executive_brief = build_costs_margin_executive_brief(
            financial_summary,
            comparison_summary,
            volume_counts,
            comparison_volume_counts,
            rates,
            build_rates(count_cohort_progress(comparison_cohort_tours)),
            financial_trend,
            location_financial_performance,
        )

    return {
        "period": period,
        "financialSummary": financial_summary,
        "financialTrend": financial_trend,
        "costEfficiencyTrend": build_cost_efficiency_trend(all_tours, financial_trend) if can_view_restricted_analytics else [],
        "locationFinancialPerformance": location_financial_performance,
        "executiveBrief": executive_brief,
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
        "pendingCounts": pending_summary,
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
        "entityHealth": entity_health,
        "executiveBriefs": executive_briefs,
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
