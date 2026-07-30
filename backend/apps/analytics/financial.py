from collections import defaultdict
from datetime import datetime, timedelta

from django.db.models import Sum
from django.utils import timezone

from apps.accounts.models import User
from apps.accounts.permissions import filter_queryset_by_location
from apps.reports.models import CostBasis

from .core import parse_csv
from .metrics import build_rates, count_cohort_progress, count_period_volume


def exclude_test_cost_basis(queryset, query_params):
    if str(query_params.get("exclude_test_data", "")).lower() in {"1", "true", "yes"}:
        return queryset.exclude(location__location_name__iexact="Authentication Test Location")
    return queryset


def build_financial_summary(user, query_params, start, end):
    queryset = exclude_test_cost_basis(filter_queryset_by_location(
        CostBasis.objects.filter(is_active=True),
        user,
    ), query_params)
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

    queryset = exclude_test_cost_basis(filter_queryset_by_location(
        CostBasis.objects.filter(is_active=True),
        user,
    ), query_params)
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
    queryset = exclude_test_cost_basis(
        filter_queryset_by_location(CostBasis.objects.filter(is_active=True), user),
        query_params,
    )
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
