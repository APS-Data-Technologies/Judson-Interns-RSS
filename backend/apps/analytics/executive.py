from .core import percent


MAX_EXECUTIVE_ITEMS = 3
MIN_AGGREGATE_TOURS = 20
MIN_ENTITY_TOURS = 10
MIN_ENROLLMENTS = 10


def format_money(value):
    return f"${value:,.0f}"


def change_percent(current, comparison):
    if not comparison:
        return None
    return round(((current - comparison) / abs(comparison)) * 100, 1)


def two_section_brief(key_figures, highlights=None, risks=None):
    highlights = list(dict.fromkeys(highlights or []))[:MAX_EXECUTIVE_ITEMS]
    risks = list(dict.fromkeys(risks or []))[:MAX_EXECUTIVE_ITEMS]
    if not highlights:
        highlights = ["No material performance improvements were identified for the selected period."]
    if not risks:
        risks = ["No material priorities or risks were identified from the selected data."]
    return {
        "keyFigures": key_figures,
        "sections": [
            {"key": "highlights", "title": "Performance Highlights", "items": highlights},
            {"key": "risks", "title": "Priorities & Risks", "items": risks},
        ],
    }


def qualified_conversion_leader(rows, overall_rate, name_key="name"):
    eligible = [row for row in rows if row.get("toured", 0) >= MIN_ENTITY_TOURS]
    if len(eligible) < 2:
        return None
    ranked = sorted(eligible, key=lambda row: row.get("conversionRate", 0), reverse=True)
    leader, runner_up = ranked[0], ranked[1]
    leader_rate = leader.get("conversionRate", 0)
    if leader_rate - overall_rate < 5 and leader_rate - runner_up.get("conversionRate", 0) < 5:
        return None
    return (
        f"{leader[name_key]} is the conversion performance leader at {leader_rate:.1f}% "
        f"across {leader['toured']:,} toured families."
    )


def conversion_improvement_focus(rows, overall_rate, name_key="name"):
    eligible = [row for row in rows if row.get("toured", 0) >= MIN_ENTITY_TOURS]
    if len(eligible) < 2:
        return None
    focus = min(eligible, key=lambda row: row.get("conversionRate", 0))
    gap = overall_rate - focus.get("conversionRate", 0)
    if gap < 5:
        return None
    return (
        f"{focus[name_key]} is an improvement focus: conversion is {gap:.1f} percentage "
        "points below the overall rate. Review funnel and follow-up execution."
    )


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
    comparison_revenue = comparison_summary["revenue"]
    comparison_cost = comparison_summary["cost"]
    comparison_margin = comparison_summary["margin"]
    comparison_margin_rate = (
        round((comparison_margin / comparison_revenue) * 100, 1)
        if comparison_revenue else None
    )
    margin_change = change_percent(margin, comparison_margin)
    revenue_change = change_percent(revenue, comparison_revenue)
    cost_change = change_percent(cost, comparison_cost)
    enrolled = current_counts["enrolled"]
    comparison_enrolled = comparison_counts["enrolled"]
    cost_per_enrollment = round(cost / enrolled, 2) if enrolled else None
    comparison_cost_per_enrollment = (
        round(comparison_cost / comparison_enrolled, 2)
        if comparison_enrolled else None
    )

    key_figures = [
        {"label": "Revenue", "value": format_money(revenue)},
        {"label": "Costs", "value": format_money(cost)},
        {"label": "Contribution Margin", "value": format_money(margin)},
        {"label": "Margin %", "value": f"{margin_rate:.1f}%" if margin_rate is not None else "—"},
        {"label": "Cost / Enrollment", "value": format_money(cost_per_enrollment) if cost_per_enrollment is not None else "—"},
    ]
    highlights = []
    risks = []

    missing_months = [
        row["month"] for row in financial_trend
        if not row["hasRevenue"] or not row["hasCost"]
    ]
    negative_months = [row for row in financial_trend if row["margin"] < 0]
    if missing_months:
        risks.append(
            f"Financial records are incomplete for {len(missing_months)} selected "
            f"month{'s' if len(missing_months) != 1 else ''}. Complete the missing records before making spending decisions."
        )
    if margin < 0:
        risks.append(
            f"Contribution margin is negative by {format_money(abs(margin))}. Review location-level revenue and cost drivers."
        )
    elif margin_rate is not None and margin_rate < 10:
        risks.append(
            f"Contribution margin is {margin_rate:.1f}%, below the 10.0% executive threshold. Review pricing and cost efficiency."
        )
    elif margin_rate is not None:
        highlights.append(
            f"Contribution margin reached {format_money(margin)} at a {margin_rate:.1f}% margin."
        )
    if len(negative_months) >= 2:
        risks.append(
            f"{len(negative_months)} selected months recorded negative contribution margin. Review recurring monthly cost drivers."
        )

    margin_delta = margin - comparison_margin
    margin_rate_delta = (
        margin_rate - comparison_margin_rate
        if margin_rate is not None and comparison_margin_rate is not None else None
    )
    material_margin_change = (
        margin_change is not None and abs(margin_change) >= 10 and abs(margin_delta) >= 10000
    ) or (margin_rate_delta is not None and abs(margin_rate_delta) >= 5)
    if material_margin_change and margin_delta > 0:
        highlights.append(
            f"Contribution margin increased by {format_money(margin_delta)}, from "
            f"{format_money(comparison_margin)} to {format_money(margin)}."
        )
    elif material_margin_change and margin_delta < 0:
        risks.append(
            f"Contribution margin declined by {format_money(abs(margin_delta))}, from "
            f"{format_money(comparison_margin)} to {format_money(margin)}. Review the locations contributing most to the decline."
        )

    if revenue_change is not None and cost_change is not None:
        unfavorable_dollar_gap = (cost - comparison_cost) - (revenue - comparison_revenue)
        if cost_change - revenue_change >= 5 and unfavorable_dollar_gap >= 5000:
            risks.append(
                f"Costs increased {cost_change:.1f}% while revenue changed {revenue_change:.1f}%. Review spending growth before expanding volume."
            )

    enrollment_change = change_percent(enrolled, comparison_enrolled)
    enrollment_delta = enrolled - comparison_enrolled
    if comparison_enrolled >= MIN_ENROLLMENTS and enrollment_change is not None:
        if enrollment_change >= 10 and enrollment_delta >= 5:
            highlights.append(
                f"Enrollments increased from {comparison_enrolled:,} to {enrolled:,}, a gain of {enrollment_delta:,} families."
            )
        elif enrollment_change <= -10 and enrollment_delta <= -5:
            risks.append(
                f"Enrollments declined from {comparison_enrolled:,} to {enrolled:,}. Investigate the locations contributing most to the decline."
            )

    if (
        cost_per_enrollment is not None
        and comparison_cost_per_enrollment is not None
        and enrolled >= MIN_ENROLLMENTS
        and comparison_enrolled >= MIN_ENROLLMENTS
    ):
        efficiency_change = change_percent(cost_per_enrollment, comparison_cost_per_enrollment)
        efficiency_delta = cost_per_enrollment - comparison_cost_per_enrollment
        if efficiency_change is not None and efficiency_change <= -10 and efficiency_delta <= -100:
            highlights.append(
                f"Cost per enrollment decreased by {format_money(abs(efficiency_delta))} to {format_money(cost_per_enrollment)}."
            )
        elif efficiency_change is not None and efficiency_change >= 10 and efficiency_delta >= 100:
            risks.append(
                f"Cost per enrollment increased by {format_money(efficiency_delta)} to {format_money(cost_per_enrollment)}. Identify locations where spending rose without matching enrollment growth."
            )

    if (
        current_counts["toured"] >= MIN_AGGREGATE_TOURS
        and comparison_counts["toured"] >= MIN_AGGREGATE_TOURS
        and current_rates["conversion"] is not None
        and comparison_rates["conversion"] is not None
    ):
        conversion_change = current_rates["conversion"] - comparison_rates["conversion"]
        if conversion_change >= 5:
            highlights.append(
                f"Conversion increased from {comparison_rates['conversion']:.1f}% to {current_rates['conversion']:.1f}%, an improvement of {conversion_change:.1f} percentage points."
            )
        elif conversion_change <= -5:
            risks.append(
                f"Conversion declined from {comparison_rates['conversion']:.1f}% to {current_rates['conversion']:.1f}%, a decrease of {abs(conversion_change):.1f} percentage points. Review funnel and follow-up execution."
            )

    normalized_locations = [
        {**row, "name": row["locationName"]}
        for row in location_rows
    ]
    leader = qualified_conversion_leader(
        normalized_locations, current_rates.get("conversion") or 0
    )
    focus = conversion_improvement_focus(
        normalized_locations, current_rates.get("conversion") or 0
    )
    if leader:
        highlights.insert(min(2, len(highlights)), leader)
    if focus:
        risks.insert(min(2, len(risks)), focus)

    return two_section_brief(key_figures, highlights, risks)


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
    highlights, risks = [], []
    favorable_up = {"scheduled", "toured", "enrolled"}
    for key, label in labels.items():
        previous = comparison[key]
        change = change_percent(current[key], previous)
        minimum_previous = MIN_ENROLLMENTS if key == "enrolled" else 5
        minimum_absolute = 5 if key in favorable_up else 3
        difference = current[key] - previous
        if change is None or previous < minimum_previous or abs(change) < 10 or abs(difference) < minimum_absolute:
            continue
        favorable = (key in favorable_up and change > 0) or (key not in favorable_up and change < 0)
        if favorable:
            highlights.append(
                f"{label} {'increased' if change > 0 else 'decreased'} from {previous:,} to {current[key]:,}."
            )
        else:
            action = "Review downstream follow-up and entity-level contributors."
            risks.append(
                f"{label} {'increased' if change > 0 else 'decreased'} from {previous:,} to {current[key]:,}. {action}"
            )

    eligible_locations = [row for row in location_rows if row.get("enrolled", 0) >= 5]
    if len(eligible_locations) >= 2:
        ranked = sorted(eligible_locations, key=lambda row: row["enrolled"], reverse=True)
        leader, runner_up = ranked[0], ranked[1]
        if leader["enrolled"] - runner_up["enrolled"] >= 5:
            highlights.insert(min(1, len(highlights)),
                f"{leader['name']} is the enrollment-volume leader with {leader['enrolled']:,} enrollments."
            )
    return two_section_brief(key_figures, highlights, risks)


def build_cohort_executive_brief(
    counts,
    previous_counts,
    rates,
    previous_rates,
    average_days,
    previous_average_days,
    pending,
):
    def rate_value(key):
        return f"{rates[key]:.1f}%" if rates[key] is not None else "—"

    key_figures = [
        {"label": "Toured Rate", "value": rate_value("toured")},
        {"label": "Conversion Rate", "value": rate_value("conversion")},
        {"label": "No Show Rate", "value": rate_value("noShow")},
        {"label": "Close Rate", "value": rate_value("close")},
        {"label": "Avg. Days to Enroll", "value": f"{average_days:.1f}" if average_days is not None else "—"},
    ]
    highlights, risks = [], []
    if counts["scheduled"] >= MIN_AGGREGATE_TOURS and previous_counts["scheduled"] >= MIN_AGGREGATE_TOURS:
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
            favorable = (change > 0) == favorable_up
            message = (
                f"{label} {'improved' if favorable else 'worsened'} from "
                f"{previous_rates[key]:.1f}% to {rates[key]:.1f}%, a change of {abs(change):.1f} percentage points."
            )
            if favorable:
                highlights.append(message)
            else:
                risks.append(f"{message} Review the entities contributing most to the change.")

    if average_days is not None and previous_average_days is not None:
        difference = average_days - previous_average_days
        if abs(difference) >= 2:
            message = (
                f"Enrollment time {'shortened' if difference < 0 else 'lengthened'} by "
                f"{abs(difference):.1f} days to {average_days:.1f} days."
            )
            if difference < 0:
                highlights.append(message)
            else:
                risks.append(f"{message} Review delays between tour completion and final outcome.")

    pending_tour = pending["pendingTourOutcome"]
    pending_enrollment = pending["pendingEnrollmentOutcome"]
    if pending_tour >= 5 or (counts["scheduled"] and percent(pending_tour, counts["scheduled"]) >= 10):
        risks.append(
            f"{pending_tour:,} past tours still need a tour outcome. Assign and resolve these updates promptly."
        )
    if pending_enrollment >= 5 or (counts["toured"] and percent(pending_enrollment, counts["toured"]) >= 10):
        risks.append(
            f"{pending_enrollment:,} toured families are beyond the expected enrollment follow-up window. Prioritize these outcomes before adding more pipeline volume."
        )
    return two_section_brief(key_figures, highlights, risks)


def build_entity_executive_brief(rows, entity_label):
    total_booked = sum(row["volume"]["booked"] for row in rows)
    total_enrolled = sum(row["volume"]["enrolled"] for row in rows)
    pending = sum(row["pendingTourOutcome"] + row["pendingEnrollmentOutcome"] for row in rows)
    eligible = [dict(row) for row in rows if row["toured"] >= MIN_ENTITY_TOURS]
    for row in eligible:
        row["conversionRate"] = percent(row["enrolled"], row["toured"])
    best = max(eligible, key=lambda row: row["conversionRate"], default=None)
    best_rate = best["conversionRate"] if best else None
    key_figures = [
        {"label": entity_label, "value": f"{len(rows):,}"},
        {"label": "Booked", "value": f"{total_booked:,}"},
        {"label": "Enrolled", "value": f"{total_enrolled:,}"},
        {"label": "Best Conversion", "value": f"{best_rate:.1f}%" if best_rate is not None else "—"},
        {"label": "Pending Outcomes", "value": f"{pending:,}"},
    ]
    highlights, risks = [], []
    total_toured = sum(row["toured"] for row in eligible)
    overall_rate = percent(sum(row["enrolled"] for row in eligible), total_toured) if total_toured else 0

    leader = qualified_conversion_leader(eligible, overall_rate)
    if leader:
        highlights.append(leader)

    focus_candidates = []
    for row in eligible:
        previous_toured = row.get("previousToured", 0)
        decline = None
        if previous_toured >= MIN_ENTITY_TOURS:
            decline = row["conversionRate"] - percent(row.get("previousEnrolled", 0), previous_toured)
        gap = overall_rate - row["conversionRate"]
        if gap >= 5 or (decline is not None and decline <= -5):
            focus_candidates.append((max(gap, abs(decline or 0)), gap, decline, row))
    if focus_candidates:
        _, gap, decline, focus = max(focus_candidates, key=lambda item: item[0])
        reasons = []
        if gap >= 5:
            reasons.append(f"{gap:.1f} percentage points below the overall rate")
        if decline is not None and decline <= -5:
            reasons.append(f"down {abs(decline):.1f} points from the comparison period")
        risks.append(
            f"{focus['name']} is the improvement focus: conversion is {' and '.join(reasons)}. Review funnel and follow-up execution."
        )

    if pending >= 5:
        pending_leader = max(
            rows,
            key=lambda row: row["pendingTourOutcome"] + row["pendingEnrollmentOutcome"],
            default=None,
        )
        if pending_leader:
            pending_count = pending_leader["pendingTourOutcome"] + pending_leader["pendingEnrollmentOutcome"]
            if pending_count >= 5 and percent(pending_count, pending) >= 25:
                risks.append(
                    f"{pending_leader['name']} holds {pending_count:,} unresolved outcomes, {percent(pending_count, pending):.1f}% of the total. Assign and resolve the backlog."
                )
    return two_section_brief(key_figures, highlights, risks)
