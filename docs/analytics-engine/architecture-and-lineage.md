# Architecture and Data Lineage

## User-facing surfaces

| Surface | Purpose |
|---|---|
| Overview | Selected-period volume, rates, and links to detailed analysis |
| Volume and Trend | Event-date activity, trends, calendars, and temporal/entity rankings |
| Conversion and Cohort | Scheduled-tour cohorts, conversion, progression time, and rankings |
| Location | Location volume, rates, related performance, timing, and unresolved outcomes |
| Lead Source | Lead-source volume, rates, related location performance, timing, and unresolved outcomes |
| Staff | Staff performance for admins and super admins |
| Costs & Margin | Completed-month revenue, cost, margin, cost efficiency, and location performance |
| Drill-through | Authorized contributing records or aggregate financial detail |
| PDF | Visual rendering of the selected analytics page |
| Excel | Backend-generated underlying tables |

## Current API surface

| Endpoint | Method | Responsibility |
|---|---|---|
| `/api/analytics/cohort/` | GET | Broad analytics response for current filters |
| `/api/analytics/drill-through/` | GET | First 100 authorized contributing tour records |
| `/api/analytics/export/` | POST | Permission-scoped Excel and server report generation |
| `/api/search/global/` | GET | Permission-scoped global record search |

The visual PDF path is generated in the browser using `html2canvas-pro` and `jsPDF`. Excel is generated in Django using `openpyxl`.

## Source entities

| Source | Grain | Role in analytics |
|---|---|---|
| `Tour` | One scheduled family tour | Cohort membership, current state, scheduled date, dimensions |
| `TourEvent` | One status event | Event-date volume and milestone timing |
| `Family` | One family | Tour identity and drill-through |
| `Location` | One operating location | Filtering, grouping, and staff access scope |
| `LeadSource` | One acquisition source | Filtering and grouping |
| `User` | One user/staff member | Assignment, grouping, role, and access scope |
| `CostBasis` | One location, month, and cost type | Revenue and expenditure facts |

## Lineage by analytics family

### Event-date volume

```text
Tour.created_at or earliest matching TourEvent.event_timestamp
    -> volume_event_timestamp()
    -> count_period_volume()
    -> totals, trends, calendars, heatmaps, and entity volume
    -> UI / drill-through / export
```

Booked uses `Tour.created_at`. Other statuses use the earliest matching event, with `Tour.updated_at` as a fallback when current status proves the milestone but no event is present.

### Cohort conversion

```text
Tour.scheduled_tour_date
    -> selected scheduled-tour cohort
    -> reached_status() over current state and event history
    -> count_cohort_progress()
    -> build_rates()
    -> rates, rankings, progression, and summaries
```

Later outcomes remain attributed to the original scheduled-tour cohort.

### Financial

```text
Active CostBasis rows for every selected calendar month
    -> location and staff-location scope
    -> monthly revenue and expenditure totals
    -> revenue - cost
    -> margin rate and cost efficiency
    -> Costs & Margin UI / summary / export
```

### Executive summaries

```text
Canonical aggregate results
    -> deterministic thresholds and qualification rules
    -> key figures and categorized findings
    -> Executive Summary UI
```

## Current computation boundary

`cohort_analytics()` orchestrates the focused core, metric, financial, ranking, and executive-rule modules in one request. It loads scoped tours and prefetched events, creates current and comparison populations, and builds most page payloads even if only one page is open.

This is the principal future modularization and performance boundary. Page-specific endpoints should eventually share the same canonical engines without recalculating unrelated pages.
