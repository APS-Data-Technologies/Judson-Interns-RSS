# Date, Period, and Cohort Rules

## Selected and comparison periods

`build_period()` creates the selected period and a previous period of identical inclusive length. If no dates are supplied, the current default is the last 30 days ending today.

Costs & Margin may provide an explicit comparison period. Explicit comparison dates override the automatically derived previous period for financial executive-summary comparisons.

## Two measurement models

### Event-date model

Used for operational activity volume and cost-efficiency denominators.

- Booked: creation date
- Toured: first toured-event date
- No Show: first no-show-event date
- Enrolled: first enrolled-event date
- Churned: first churned-event date

Question answered: **What activity occurred during this period?**

### Cohort model

Used for conversion and progression.

- Cohort membership is determined by scheduled tour date.
- Outcomes can happen after the selected period.
- Later outcomes remain attached to their scheduled-tour cohort.

Question answered: **What eventually happened to the families scheduled during this period?**

These models must never be combined without being explicitly labeled.

## Financial periods

- Financial records have monthly grain.
- A date range that touches a month includes the entire reporting month.
- Costs & Margin restricts selection to completed months.
- The current month is not selectable.
- Comparison ranges contain the same number of months as the selected range.
- Revenue and expenditure records are filtered by active status.

## Time zone

Django stores and processes timezone-aware values with the project timezone configured as UTC. Event-date functions convert timestamps using Django local-time handling before extracting dates.

The frontend formats dates in the browser's local timezone. This creates a boundary risk for events near midnight and must be covered by explicit timezone tests before a metric-version release.

## Rescheduling

Current cohort membership uses the current `scheduled_tour_date`. Rescheduling updates that date and the current status. Event history retains the rescheduled event, but the engine does not currently preserve an immutable original cohort date as a separate field.

This is a documented limitation: historical cohort membership can move when a tour is rescheduled.

## Missing events

When a tour's current status proves a milestone but the corresponding event is missing, event-date calculations fall back to `Tour.updated_at`.

This preserves a usable result but weakens exact lineage. Data-quality reporting should identify every fallback occurrence.

## Period disclosure requirements

The UI and exports should disclose:

- Selected period
- Comparison period
- Event-date or cohort-date basis
- Completed-month handling
- Data-through date
- Time zone
- Whether the result is partial, truncated, or based on a fallback timestamp
