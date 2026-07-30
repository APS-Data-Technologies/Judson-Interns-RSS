from django.utils import timezone

from apps.tours.models import TourStatus

from .rankings import (
    build_entity_health,
    build_ranking,
    build_volume_performance_ranking,
    compress_rate_trend,
    compress_volume_trend,
    sort_ranking,
)
from .financial import (
    build_cost_efficiency_trend,
    build_financial_summary,
    build_financial_trend,
    build_location_financial_performance,
)
from .metrics import (
    PROGRESS_BUCKETS,
    SHORT_PROGRESS_BUCKETS,
    average_days_to_enroll,
    build_rates,
    build_time_to_progress,
    build_trend_data,
    build_volume_calendar_data,
    build_volume_heatmap,
    build_volume_trend_data,
    count_cohort_progress,
    count_period_volume,
    filter_by_scheduled_period,
    pending_counts,
    reached_status,
)
from .executive import (
    build_cohort_executive_brief,
    build_costs_margin_executive_brief,
    build_entity_executive_brief,
    build_volume_executive_brief,
)
from .core import (
    apply_filters,
    base_queryset,
    build_period,
    delta,
    normalize_metric,
    parse_cost_basis,
    parse_csv,
    parse_date,
    rate_delta,
    titleize,
)


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
    staff_option_queryset = apply_filters(scoped_queryset, {
        "exclude_test_data": query_params.get("exclude_test_data"),
    })
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
