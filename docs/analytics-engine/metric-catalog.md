# Metric Catalog

Metric version: `current-unversioned`

Formal metric version identifiers must be introduced before formulas are changed.

## Volume metrics

| Metric | Canonical definition | Date basis | Empty behavior | Implementation |
|---|---|---|---|---|
| Booked | Count of tours created in the selected period | `Tour.created_at` | `0` | `volume_event_timestamp()`, `count_period_volume()` |
| Toured | Count of tours whose first toured event falls in the selected period | Earliest Toured event; current-state fallback uses `updated_at` | `0` | Same |
| No Show | Count of tours whose first no-show event falls in the selected period | Earliest No Show event; fallback uses `updated_at` | `0` | Same |
| Enrolled | Count of tours whose first enrolled event falls in the selected period | Earliest Enrolled event; fallback uses `updated_at` | `0` | Same |
| Churned | Count of tours whose first churned event falls in the selected period | Earliest Churned event; fallback uses `updated_at` | `0` | Same |

Event-date volume powers Volume and Trend totals, trend charts, calendars, heatmaps, entity volume, and volume executive summaries.

## Cohort metrics

The population is tours whose `scheduled_tour_date` falls inside the selected period.

| Metric | Formula | Qualification | Empty behavior | Implementation |
|---|---|---|---|---|
| Booked cohort | Count of tours in the scheduled-tour cohort | Scheduled date in range | `0` | `count_cohort_progress()` |
| Toured cohort | Cohort tours that ever reached Toured | Current state or event history | `0` | `reached_status()` |
| No-show cohort | Cohort tours that ever reached No Show | Current state or event history | `0` | `reached_status()` |
| Enrolled cohort | Cohort tours that ever reached Enrolled | Current state or event history | `0` | `reached_status()` |
| Churned cohort | Cohort tours that ever reached Churned | Current state or event history | `0` | `reached_status()` |
| Toured Rate | `Toured / Booked × 100` | Scheduled cohort | `0%` when denominator is zero | `build_rates()` |
| No Show Rate | `No Show / Booked × 100` | Scheduled cohort | `0%` when denominator is zero | `build_rates()` |
| Conversion Rate | `Enrolled / Toured × 100` | Scheduled cohort | `0%` when denominator is zero | `build_rates()` |
| Close Rate | `(Enrolled + Churned) / Toured × 100` | Scheduled cohort | `0%` when denominator is zero | `build_rates()` |
| Average Days to Enroll | Mean of `first enrollment event date - scheduled tour date` | Enrolled cohort tours with an enrollment date | `null` / em dash when none | `average_days_to_enroll()` |

## Progression metrics

| Transition | Start | End |
|---|---|---|
| Booked → Toured | Tour creation timestamp | First toured event |
| Booked → No Show | Tour creation timestamp | First no-show event |
| Toured → Enrolled | First toured event | First enrolled event |
| Toured → Churned | First toured event | First churned event |
| Booked → Enrolled | Scheduled tour date | First enrolled event |

Negative elapsed durations and missing endpoints are excluded. Short selected periods use smaller display buckets; longer periods use the standard buckets.

## Follow-up metrics

| Metric | Definition |
|---|---|
| Awaiting tour outcome | Scheduled or rescheduled tour date is in the past, with neither Toured nor No Show recorded |
| Awaiting enrollment outcome | Toured, no Enrolled or Churned outcome, and days since scheduled tour exceed the selected cohort's average days to enroll |
| Off track | Tour meets either applicable pending-outcome rule |

The enrollment follow-up threshold is data-dependent because it uses the selected population's average days to enroll.

## Financial metrics

Financial data is monthly. Any touched month is included as a complete reporting month. The current incomplete month is excluded by the Costs & Margin UI.

| Metric | Formula | Source | Empty behavior | Implementation |
|---|---|---|---|---|
| Revenue | Sum of active Revenue rows | `CostBasis` | `$0` | `build_financial_summary()` |
| Costs | Sum of active Expenditure rows | `CostBasis` | `$0` | Same |
| Contribution Margin | `Revenue - Costs` | Derived | May be negative | Same |
| Margin % | `Contribution Margin / Revenue × 100` | Derived | Em dash/zero presentation when revenue is zero | Financial service/UI |
| Cost per Booked Tour | `Costs / event-date Booked` | Monthly cost and event-date volume | Em dash when count is zero | `build_cost_efficiency_trend()` |
| Cost per Completed Tour | `Costs / event-date Toured` | Same | Em dash when count is zero | Same |
| Cost per Enrollment | `Costs / event-date Enrolled` | Same | Em dash when count is zero | Same |
| Location Margin Share | `Location Margin / total selected Margin × 100` | Location monthly financial totals | Em dash when denominator is zero | Costs & Margin UI |

## Ranking metrics

| Metric | Value used |
|---|---|
| Enrollments | Enrolled cohort count |
| Conversion | Enrolled cohort / toured cohort |
| Toured rate | Toured cohort / booked cohort |
| Close rate | (Enrolled + Churned) / Toured |
| Average days | Average scheduled-tour-to-enrollment days |
| Contribution margin estimate | Enrolled count multiplied by selected cost basis parameter, when supplied |

Entity comparisons qualify or suppress values when denominators are not meaningful. Executive summaries impose additional minimum sample sizes documented separately.

## Reconciliation requirement

For identical filters and metric versions:

```text
Headline value = chart aggregate = drill-through definition = Excel value
```

The visual PDF is a rendering of the displayed page and should reproduce the displayed values rather than independently recalculate them.
