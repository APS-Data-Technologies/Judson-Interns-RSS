from .core import percent


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
