# Judson Interns RSS Analytics Follow-up Handoff

Date: July 22, 2026
Purpose: detailed continuation context for a future development task in the same project

## Start Here

Repository:

```text
/Users/jagadeshkumarparanthaman/Projects/Judson-Interns-RSS
```

GitHub:

```text
https://github.com/APS-Data-Technologies/Judson-Interns-RSS
```

Current local branch:

```text
feature/analytics-follow-up
```

Current HEAD and `origin/develop` when this handoff was written:

```text
8859a68 Merge pull request #37 from APS-Data-Technologies/feature/cost-analytics
```

Working-tree state:

- The tracked working tree is clean before adding this handoff document.
- `database/backups/` is intentionally untracked user data. Preserve it and do not stage, delete, or modify it.
- The current branch was created from the latest `origin/develop` through the documented `kr cleanup` workflow.
- PR #37 merged the cost analytics, entity-insight, access-control, and responsive-layout changes described below.

The configured desktop workspace may open at `/Users/jagadeshkumarparanthaman/Documents/RSS`; that is not this repository. Run commands from the repository path above.

## Product Direction

The analytics area is intended to answer executive questions with concise insights rather than an excessive number of charts. Numbers and visuals should be used only where they materially improve comprehension. Existing detailed pages remain useful for exploration, while a future executive dashboard may summarize cross-page findings primarily as bullet points.

Global analytics filters are:

- Time period
- Location
- Lead source
- Staff

Visual content should update consistently with those filters. A staff user belongs to one location, so location-sensitive analytics must be restricted to that location.

## Analytics Pages and Current Behavior

Analytics navigation currently contains:

1. Overview
2. Volume and Trend
3. Conversion and Cohort
4. Location
5. Lead Source
6. Staff
7. Cost and Margin

Relevant route definitions are in:

```text
frontend/src/App.jsx
frontend/src/features/auth/ProtectedRoute.jsx
frontend/src/features/auth/RoleRoute.jsx
```

### Overview

The overview shows selected-period volume, rates, performance insights, and links into the detailed analytics pages.

Financial definitions:

- Revenue: sum of active revenue cost-basis records for every reporting month touched by the selected date range.
- Cost: sum of active expenditure records for the same months and filtered locations.
- Contribution margin: revenue minus cost.
- Staff filtering maps financial totals to the selected staff member's location.

The Cost and Margin overview card and Staff Analytics overview card are visible only to admins and super admins.

### Volume and Trend

This page includes:

- Status volumes and event shares
- Current versus previous-period comparisons
- Temporal volume rankings by quarter, month, week of month, day of month, and day of week
- Volume-performance rankings by location, lead source, and staff
- Percentage share shown in smaller text beside ranked volumes
- Matching bar and value color treatment
- Trend and calendar/heatmap views

Temporal ranking cards use navy/gold emphasis for the top item and color-coded values for subsequent items.

### Conversion and Cohort

This page includes:

- Conversion and cohort rates
- Time to progress
- Temporal conversion rankings
- Cohort-aware rate calculations based on scheduled-tour cohorts
- Ranking styling aligned with Volume and Trend

An enrollment shown for a scheduled-date cohort means the family was scheduled in that cohort and later enrolled; it does not necessarily mean enrollment occurred on the cohort date.

### Location, Lead Source, and Staff Insights

The main insights table supports Volume metrics and Rate metrics.

Common table structure:

- Entity name
- Positives
- Needs Attention
- Entity Performance where applicable
- Peak Periods
- Five primary volume or rate metrics with current, previous, and difference values
- Off-track tours
- Five stacked status/rate trend sparklines at the end

Volume mode metrics:

- Booked
- Toured
- No Show
- Enrolled
- Churned

Rate mode metrics:

- Toured Rate
- Conversion Rate
- No Show Rate
- Close Rate
- Average Days to Enroll

Trend sparklines show the ending value and distinguish constant zero from constant nonzero values by vertical position. Volume sparklines are derived from event-date volumes rather than the current aggregate total.

Entity Performance rules:

- Location Insights shows best/lowest Lead Source and Staff.
- Lead Source Insights shows best/lowest Location.
- Staff Insights intentionally does not show Lead Source or other cross-entity performance.
- Volume mode ranks related entities by enrolled volume and omits numeric values.
- Rate mode ranks related entities by conversion rate and omits numeric values.
- Entity labels use a navy badge with gold text; best names are green and lowest names are red, stacked vertically.

Peak Periods summarizes best-performing quarter, month, week of month, and day of week. Trends appear after Peak Periods.

The page headings are:

- Location Insights
- Lead Source Insights
- Staff Insights

The subheading is simply `Current vs previous period`.

### Off-track Meaning

Off-track is outcome follow-up, not raw toured/enrolled volume:

- Awaiting tour outcome: scheduled/rescheduled tour date is in the past with neither Toured nor No Show recorded.
- Awaiting enrollment outcome: reached Toured but has neither Enrolled nor Churned after the expected follow-up window.

The UI wording was changed to avoid making `4 tour · 2 enroll` look like ordinary status totals. Summary/attention content shows all applicable positive and negative signals rather than only one priority.

## Cost Basis Management and Analytics Permissions

Do not conflate Cost Basis management with Cost Basis analytics.

- Staff Analytics: admins and super admins only.
- Cost and Margin Analytics: admins and super admins only.
- Staff users do not see these options in the analytics title picker.
- Direct staff navigation to those routes redirects to Home.
- The Django analytics payload returns zero financial totals and empty staff analytics/ranking sections to staff users, preventing access through direct API calls.
- Cost Basis management remains governed by its existing, stricter behavior. Existing backend tests currently deny management to ordinary admins and allow super admins. Do not broaden management permission merely because analytics is available to admins.

Permission implementation is primarily in:

```text
frontend/src/App.jsx
frontend/src/features/auth/ProtectedRoute.jsx
frontend/src/features/auth/RoleRoute.jsx
frontend/src/pages/Analytics/Analytics.jsx
backend/apps/analytics/services.py
```

`RoleRoute` forwards the parent outlet context. This is required because nested protected analytics routes consume `setAnalyticsLoading`; omitting context forwarding causes an application crash.

## Responsive Design Contract

Analytics now uses two layout modes, not three:

1. Mobile mode for phones and portrait tablets up to 1180 px wide.
2. Laptop mode for landscape tablets and desktop/laptop screens.

Portrait tablets must not use an intermediate hybrid tablet layout. If a component fits horizontally in the established mobile composition, keep that same arrangement on portrait tablets. Otherwise stack it exactly as mobile does. Landscape tablets retain the laptop arrangement.

Key responsive rules are in:

```text
frontend/src/pages/Analytics/Analytics.css
frontend/src/components/layout/TitleBar/TitleBar.css
frontend/src/components/layout/AppShell/AppShell.css
```

The portrait-tablet rules:

- Hide the `Analytics:` title prefix, matching mobile.
- Stack Volume and Rate entity-comparison cards.
- Stack donut/rate internal layouts.
- Use mobile control/header composition.
- Preserve interaction behavior and prevent document-level horizontal overflow.

Verified viewport classes:

- 390 × 844: phone/mobile mode
- 768 × 1024: portrait tablet/mobile mode
- 1024 × 1366: large portrait tablet/mobile mode
- 1024 × 768: landscape tablet/laptop mode

Browser verification found and fixed the nested `RoleRoute` context crash. All tested routes rendered without application errors or page-level horizontal overflow.

## Important Backend Files

```text
backend/apps/analytics/services.py
backend/apps/analytics/views.py
backend/apps/analytics/tests/test_financial_summary.py
backend/apps/reports/models.py
backend/apps/reports/tests/test_cost_basis_api.py
```

`cohort_analytics()` is the main response builder. It currently gates restricted financial and staff sections based on the requesting user's role.

`build_financial_summary()` still contains reusable location-aware accounting logic. Its direct service tests intentionally verify location scoping, including staff-location scoping; response-level role gating happens in `cohort_analytics()`.

## Important Frontend Files

```text
frontend/src/pages/Analytics/Analytics.jsx
frontend/src/pages/Analytics/Analytics.css
frontend/src/features/auth/ProtectedRoute.jsx
frontend/src/features/auth/RoleRoute.jsx
frontend/src/components/layout/TitleBar/TitleBar.css
frontend/src/App.jsx
```

`Analytics.jsx` is large and contains data adapters, overview cards, temporal rankings, entity comparison visuals, insight tables, trend primitives, and local fallback calculations. Make focused edits and run lint after changes.

## Open Product Work

The main discussed but not yet implemented direction is a separate Executive Dashboard.

Desired character:

- Primarily bullet-point insights, not another dense collection of charts.
- Use a few headline numbers or compact visuals only when necessary.
- Explain combined signals, for example: conversion improved while lead volume fell 50–60%, meaning efficiency improved but pipeline health deteriorated.
- Potential content includes volume/rate interaction, trend direction, entity performance, peak periods, notable off-track outcomes, and material changes from the previous period.
- Filters should remain Time, Location, Lead Source, and Staff.
- Content should adapt to filters rather than using different visual structures for each filter combination.

Other known future work:

- The dedicated Cost and Margin Analytics route remains a placeholder; only the overview financial card and backend financial summary are implemented.
- Analytics export was discussed but deferred. If implemented, support `Current view` and `All views`; do not silently export hidden configurations.
- Continue evaluating whether cross-page questions are sufficiently covered, but avoid adding redundant visuals.

## Validation Commands

Frontend:

```bash
cd /Users/jagadeshkumarparanthaman/Projects/Judson-Interns-RSS/frontend
npm run lint
npm run build
```

Relevant backend tests:

```bash
cd /Users/jagadeshkumarparanthaman/Projects/Judson-Interns-RSS
DATABASE_URL='sqlite:///:memory:' backend/venv/bin/python backend/manage.py test \
  apps.analytics.tests.test_financial_summary \
  apps.reports.tests.test_cost_basis_api
```

Before committing:

```bash
git diff --check
git status --short
git diff --stat
```

The most recent validation passed:

- Frontend ESLint
- Frontend Vite production build
- 15 relevant Django tests
- Responsive browser checks at the four viewport sizes listed above

The Vite build may report the existing warning about a JavaScript chunk larger than 500 kB; the build still succeeds.

## User Git Shorthand

### `kr commit`

This is not merely `git commit`. Perform the complete workflow:

1. Check and review the working tree.
2. Run relevant validation.
3. Commit locally.
4. Fetch/pull latest GitHub `develop`.
5. Merge `origin/develop` into the feature branch.
6. Analyze and resolve conflicts carefully.
7. Re-run validation after merging.
8. Push the feature branch to GitHub.
9. Provide a PR title and detailed PR description.
10. The user creates/merges the PR and later says `done`.

Never push directly to `develop` unless the user explicitly requests that exact workflow.

### `kr cleanup`

1. Check for uncommitted work and preserve user work.
2. Fetch latest GitHub `develop`.
3. Switch to local `develop`.
4. Update it safely with `git pull --ff-only origin develop`.
5. Create a clean new `feature/...` branch from latest `origin/develop`.

The current branch `feature/analytics-follow-up` was created using this workflow.

## Continuation Instructions for the New Task

Read this entire document before taking action. Then inspect the current branch and repository status. Do not modify or stage `database/backups/`.

There is no new implementation request beyond establishing the handoff. Begin by confirming:

- Repository path
- Current branch and HEAD
- Tracked/untracked working-tree state
- Understanding of the two-mode responsive contract
- Understanding of Staff and Cost/Margin analytics permissions
- Understanding of the full `kr commit` and `kr cleanup` workflows

Wait for the user's next product request after confirming readiness.
