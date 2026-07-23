# Ready Set STEM Analytics Engine

## Purpose

The Ready Set STEM Analytics Engine converts tour, enrollment, operational, and monthly financial records into clear information for leadership decisions.

It supports:

- Executive performance summaries
- Volume and pipeline trends
- Conversion and cohort analysis
- Location and lead-source performance
- Staff performance
- Costs, contribution margin, and cost efficiency
- Drill-through and report exports

The objective is not to display more charts. It is to help leadership quickly understand what is working, what needs attention, and where action is required.

## How it works

```text
Operational and Financial Records
                ↓
Permissions, Filters, and Date Rules
                ↓
Standard Business Metrics
                ↓
Comparisons, Rankings, and Decision Rules
                ↓
Dashboards, Executive Summaries, Drill-through, PDF, and Excel
```

React presents the analytics experience. Django applies permissions and business rules. PostgreSQL stores the operational and financial records. Calculations are performed from the current authorized data whenever analytics are requested.

## Core business logic

### Activity volume

Volume answers: **What activity happened during the selected period?**

- Booked uses the date the tour record was created.
- Toured, No Show, Enrolled, and Churned use the date each event occurred.
- Trends, calendars, and cost-efficiency denominators use this event-date model.

### Cohort performance

Cohort analysis answers: **What eventually happened to families scheduled during the selected period?**

- Families are grouped by their scheduled tour date.
- Later outcomes remain connected to that scheduled-tour group.
- A later enrollment does not mean the enrollment occurred during the cohort month.

### Primary rates

| Metric | Business definition |
|---|---|
| Toured Rate | Toured ÷ Booked |
| No Show Rate | No Shows ÷ Booked |
| Conversion Rate | Enrolled ÷ Toured |
| Close Rate | Enrolled plus Churned ÷ Toured |
| Average Days to Enroll | Average time from scheduled tour date to enrollment |

### Follow-up health

- **Awaiting tour outcome:** the tour date has passed, but neither Toured nor No Show has been recorded.
- **Awaiting enrollment outcome:** the family toured but has no Enrolled or Churned outcome after the expected follow-up window.
- These are operational follow-up measures, not ordinary status totals.

### Financial analysis

Financial reporting is monthly.

- Revenue is the total active monthly revenue.
- Costs are the total active monthly expenditures.
- Contribution Margin is Revenue minus Costs.
- Margin % is Contribution Margin divided by Revenue.
- Cost Efficiency is monthly Costs divided by Booked, Toured, or Enrolled activity.
- The current incomplete month is excluded.
- A selected range includes complete reporting months.
- Comparison periods contain the same number of months.

## Executive Summary

Executive summaries are generated from documented, deterministic rules.

They present:

- Key figures
- What is working
- What needs attention
- Recommended actions
- Critical alerts

The engine considers materiality and minimum data volume before highlighting a change. Examples include:

- Meaningful increases or declines in volume
- Rate movements large enough to matter
- Rising cost per enrollment
- Costs growing faster than revenue
- Declining enrollment volume
- Unresolved follow-up outcomes
- Missing financial records
- Negative contribution margin

The summary is generated from the active filters and comparison period. It is designed to stand on its own for leadership without requiring review of every chart.

## Filters and comparisons

Operational analytics support:

- Time period
- Location
- Lead source
- Staff

Costs & Margin supports:

- Completed-month period
- Equal-length comparison months
- Location

All affected numbers, charts, summaries, drill-through results, and exports must respond consistently to the selected filters.

## Access and permissions

| Capability | Staff | Admin | Super Admin |
|---|---:|---:|---:|
| Operational analytics | Assigned location | All locations | All locations |
| Location and lead-source analytics | Assigned location data | Yes | Yes |
| Staff Analytics | No | Yes | Yes |
| Costs & Margin Analytics | No | Yes | Yes |
| Drill-through and exports | Assigned location | Authorized data | Authorized data |
| Cost-basis management | No | No | Yes |

Permissions are applied by the backend before calculations are performed. Hiding a page in the user interface is not treated as the security boundary.

Selecting “All authorized data” removes optional filters but never expands the user’s permission scope.

## Data freshness and loading

Analytics are currently calculated when requested.

- Opening a page or changing a filter requests a fresh calculation.
- Results reflect committed database records available at that time.
- There is currently no scheduled analytics refresh, stored analytics snapshot, or calculation cache.
- A future cache or scheduled aggregation should be introduced only if measured data volume and response times require it.

Leadership should eventually see:

- Calculated time
- Data-through date
- Selected and comparison periods
- Whether information is incomplete or truncated

## Drill-through and exports

Drill-through allows users to move from a headline value to its authorized contributing data.

- Laptop and landscape desktop screens use a right-side drawer.
- Mobile and portrait screens use a full-screen detail view.
- Drill-through retains the active period and filters.
- Large results show a limited preview and can be exported.

PDF and Excel serve different purposes:

- **PDF:** a visual representation of the designed analytics page.
- **Excel:** underlying data tables for additional analysis.

Exports reapply permissions and must reconcile with the displayed analytics.

## Data preservation

The system favors preserving history.

- Tours are not deleted through ordinary workflows.
- Tour status events preserve progression history.
- Locations, lead sources, users, and financial records can be made inactive.
- Financial records are excluded from analytics when inactive.
- Cost-basis management does not provide normal deletion.

A formal organizational policy is still required for retention, historical corrections, audited purge, backup frequency, and restoration.

## Governance

Core formulas are controlled through reviewed application code. They are not editable by admins or super admins from the user interface.

This prevents an accidental setting change from silently redefining leadership reporting.

Future super-admin settings may safely control:

- Default reporting periods
- Maximum reporting history
- Approved alert thresholds
- Refresh and cache operations, if introduced
- Noncritical summary options

Every important change should be documented, tested, reviewed, and validated across dashboards, summaries, drill-through, and exports.

## Reliability standard

For the same user permissions and filters:

```text
Headline number
    = Chart total
    = Drill-through population
    = Excel result
```

This reconciliation principle is the central trust requirement of the Analytics Engine.

## Current implementation and direction

The engine is organized into separate responsibilities for:

- Permissions and filters
- Date and comparison periods
- Volume and cohort metrics
- Financial calculations
- Rankings and entity performance
- Executive-summary rules
- Drill-through and exports

The next improvements should focus on:

1. Page-specific analytics requests for faster loading
2. Clear data-freshness and completeness information
3. Data-quality checks
4. Explicit limits for large date ranges and exports
5. Performance measurement before introducing caching
6. A read-only administrative view of engine health, permissions, and metric definitions

The result is an Analytics Platform—not simply a collection of dashboards—with consistent business definitions, controlled access, explainable decisions, and a clear path for growth.
