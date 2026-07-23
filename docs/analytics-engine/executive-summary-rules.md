# Executive Summary Rule Catalog

Executive summaries are deterministic, documented, and filter-aware.

## Common presentation

Each summary may contain:

- Key Figures
- What's Working
- Needs Attention
- Recommended Actions
- Critical Alerts

The rule functions limit output to three positive findings, three attention findings, two actions, and two alerts.

## Volume summary

- Shows Booked, Toured, No Show, Enrolled, and Churned.
- A comparison finding requires at least five records in the comparison value.
- A material change requires at least 10%.
- Booked, Toured, and Enrolled increases are favorable.
- No Show and Churned decreases are favorable.
- Identifies the location with the greatest enrollment volume.
- Recommends downstream review when bookings hold or rise but enrollments fall.
- Recommends no-show action when no-shows increase from a qualified comparison base.

Implementation: `build_volume_executive_brief()`.

## Cohort summary

- Shows Toured Rate, Conversion Rate, No Show Rate, Close Rate, and Average Days to Enroll.
- Rate comparisons require at least ten booked cohort tours in both periods.
- A material rate movement requires at least five percentage points.
- An enrollment-time finding requires at least a two-day change.
- Past tours without an outcome are attention items.
- Toured families beyond the expected enrollment window trigger an alert and action.

Implementation: `build_cohort_executive_brief()`.

## Entity summaries

Applies to Location, Lead Source, and Staff.

- Best conversion requires at least ten toured families.
- Reports the enrollment-volume leader.
- Conversion decline requires at least ten toured families in both periods and a decline of at least five percentage points.
- Reports the entity with the largest unresolved follow-up load.

Implementation: `build_entity_executive_brief()`.

## Costs & Margin summary

- Shows Revenue, Costs, Contribution Margin, Margin %, and Cost per Enrollment.
- Margin improvement/decline requires at least 5% and an absolute $1,000 difference.
- Cost-per-enrollment findings require at least five enrollments in both periods and a 10% change.
- Cost growth outpacing revenue growth by at least five percentage points triggers attention.
- Enrollment decline requires a comparison base of five and a decline of at least 10%.
- Conversion findings require at least ten toured families in both periods and five percentage points of movement.
- Missing monthly revenue or cost records trigger a critical alert.
- Negative selected-period margin triggers a critical alert.
- Two or more negative-margin months trigger a critical alert.

Implementation: `build_costs_margin_executive_brief()`.

## Change-control requirement

Thresholds currently reside in code. Before thresholds become configurable:

1. Assign stable rule IDs.
2. Introduce rule versions and effective dates.
3. Store approved values only.
4. Audit every change.
5. Preview affected findings before activation.
6. Invalidate cached results after activation.
7. Preserve the rule version used for every generated summary.
