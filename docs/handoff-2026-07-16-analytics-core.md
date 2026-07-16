# Judson Interns RSS Analytics Core Handoff

Date: July 16, 2026

This handoff captures the current state of the `feature/analytics-core` branch after the analytics foundation, pipeline/tour follow-up indicators, and responsive analytics flow refinements. Use this document at the start of the next session before continuing UI or API work.

## Repository State

Repository:

```text
/Users/jagadeshkumarparanthaman/Projects/Judson-Interns-RSS
```

GitHub repository:

```text
https://github.com/APS-Data-Technologies/Judson-Interns-RSS
```

Current branch:

```text
feature/analytics-core
```

This branch was created after the previous analytics/redesign work was merged. Work was committed locally after validation. The branch should still be pushed as a feature branch for PR review unless the user explicitly asks otherwise.

## Product Direction

The app is an internal Ready Set STEM enrollment tracker for staff, admins, and super admins.

Current workflow focus:

```text
Tour scheduled
  -> Tour outcome: Toured or No Show
  -> Enrollment outcome from Toured: Enrolled or Churned
  -> Event history tracks status changes
  -> Analytics summarizes the selected-period cohort and compares it to the previous equivalent period
```

Important business definitions used in the current UI:

- Home page today's booked tours: tours scheduled for today.
- Home page yesterday's no-shows: tours scheduled yesterday and marked no show.
- Tours page: tours scheduled inside the selected date range.
- Pipeline page: status workflow view; default date range is All Time.
- Analytics page: selected-period cohort analytics with previous equivalent period comparison.

## Branch Summary

### Analytics Page

Main file:

```text
frontend/src/pages/Analytics/Analytics.jsx
frontend/src/pages/Analytics/Analytics.css
```

Implemented and refined:

- Selected-period analytics with comparison to previous equivalent period.
- Date comparison behavior:
  - Today compares to yesterday.
  - Last 30 days compares to previous 30 days.
  - Custom date ranges compare to the same number of previous days.
  - Month/year-style periods should compare to previous month/year if those filters are added later.
- Cohort count cards for:
  - Booked
  - Toured
  - No Show
  - Enrolled
  - Churned
- Rate cards for:
  - Toured rate = toured / booked
  - No show rate = no show / booked
  - Close rate = (enrolled + churned) / toured
  - Conversion rate = enrolled / toured
- Operational metrics:
  - Average days to enroll
  - Pending toured / no show
  - Pending enrolled / churned
- Ranking sections for:
  - Location
  - Lead source
  - Staff
- Ranking metric selector supports:
  - Conversion rate
  - Close rate
  - Toured rate
  - Enrollments
  - Contribution margin
  - Average days to enrollment
- Ranking direction selector supports:
  - Best performing
  - Least performing
- Trend section supports grouped period viewing with navigation controls.
- Info icons are clickable and show short explanations for metrics.

Latest layout change:

- The analytics flow was changed to the Option A "Branch Map" pattern for all screen sizes:

```text
          Booked
        /        \
    Toured     No Show
    /    \
Enrolled  Churned
```

- The flow uses thin connector lines instead of arrow glyphs.
- Card sizes scale through CSS variables instead of changing structure between breakpoints.
- On mobile, the same branch map remains visible with reduced card height, smaller labels, and tighter spacing.

### Home Page Action Needed

Relevant files may include:

```text
frontend/src/pages/Home/Home.jsx
frontend/src/pages/Home/Home.css
```

Current intended behavior from recent work:

- Home should show an Action Needed section instead of full pending-tour card lists.
- The section should call out:
  - Booked tours past tour date without toured/no-show outcome.
  - Toured tours beyond average enrollment time without enrolled/churned outcome.
- The action prompt should send users to Pipeline with off-track tours filtered.
- The user asked that explanatory guidance live behind an info icon where possible.

If Home changes are not present on this branch, reapply them from the latest merged develop work or prior branch before continuing.

### Tours and Pipeline Follow-Up Indicators

Main files:

```text
frontend/src/pages/Tours/Tours.jsx
frontend/src/pages/Tours/Tours.css
frontend/src/pages/Tours/TourPlaceholder.jsx
frontend/src/pages/Tours/TourPlaceholder.css
frontend/src/pages/Pipeline/Pipeline.jsx
frontend/src/pages/Pipeline/Pipeline.css
```

Implemented/refined across recent branch work:

- Date filter default changed toward All Time for Tours and Pipeline.
- Date filter options should include:
  - All Time
  - Today
  - Last 30 days
  - Last N days
  - Next N days
  - From/To custom date inputs
- Tours and Pipeline have off-track category logic:
  - On track
  - Off track
- Off-track definition:
  - Booked tour is past tour date and has no toured/no-show outcome.
  - Toured tour is beyond average enrollment time and has no enrolled/churned outcome.
- Tour cards should show compact days-past badges without changing the layout of status/actions.
- Family card summaries should show only:
  - Family name
  - Location
  - Date/time
  unless the user is in a detail or edit view.
- Names, locations, lead sources, and users should display in title case regardless of how data is stored.

### Unsaved Changes Prompt

Main file:

```text
frontend/src/hooks/useUnsavedChangesPrompt.js
```

Recent work includes replacing browser-native confirmation behavior with app-level confirmation UI where possible.

Current expectation:

- New Tour and Edit Tour pages should not save on Enter.
- Save should validate required fields first.
- Save should ask for confirmation in the UI.
- Back/cancel with unsaved changes should show one app-level confirmation, not duplicate alerts.
- Confirmation copy should use page names, not full URLs.

## Backend Notes

No backend model or migration changes were intentionally made in this branch.

The analytics work is currently frontend-derived from existing tour data and tour event history. This is acceptable for the current UI foundation, but longer-term this should move to a backend analytics endpoint for:

- Cohort accuracy.
- Large dataset performance.
- Shared calculations between frontend, reports, and exports.
- Easier test coverage for formulas.

Potential backend follow-up endpoint:

```text
GET /api/analytics/cohort-summary/
```

Suggested query params:

```text
date_from
date_to
location
lead_source
cost_basis
metric
ranking_direction
```

Suggested response sections:

```text
period
comparison_period
counts
rates
pending_outcomes
trend
rankings
```

## UI and Design Conventions

The app is being aligned to the official Ready Set STEM website:

```text
https://www.readysetstem.org/
```

Design direction:

- Official brand logo in the top bar.
- Blue-to-cyan brand header.
- Dark navy and gold/yellow accents.
- White content cards with soft borders.
- Mobile-first behavior.
- Filters must never overlap cards or page title bars.
- In mobile/portrait, filters usually collapse behind the master filter control.
- Bottom navigation stays visible in mobile.
- Sidebar stays visible in landscape/desktop.

Status colors:

- Booked: blue
- Toured: yellow/gold
- Enrolled: green
- Churned: red
- No Show: orange
- Cancelled: grey
- Rescheduled: purple

Avoid using the booked blue for unrelated action buttons when possible. Primary action colors should be brand-compatible but distinct from status meanings.

## Validation Completed

Frontend lint:

```bash
cd /Users/jagadeshkumarparanthaman/Projects/Judson-Interns-RSS/frontend
npm run lint
```

Result:

```text
Passed
```

Frontend build:

```bash
cd /Users/jagadeshkumarparanthaman/Projects/Judson-Interns-RSS/frontend
npm run build
```

Result:

```text
Passed
```

Build output observed:

```text
vite v8.1.1 building client environment for production...
✓ built
```

## Local Development Commands

Start backend:

```bash
cd /Users/jagadeshkumarparanthaman/Projects/Judson-Interns-RSS
backend/venv/bin/python backend/manage.py runserver 127.0.0.1:8000
```

Start frontend:

```bash
cd /Users/jagadeshkumarparanthaman/Projects/Judson-Interns-RSS/frontend
npm run dev -- --host 127.0.0.1 --port 5173
```

Frontend URL:

```text
http://127.0.0.1:5173/login
```

Backend health check:

```text
http://127.0.0.1:8000/api/health
```

Do not switch to SQLite. This project is intended to use Django with PostgreSQL, including Railway PostgreSQL for deployed environments.

## Recommended Next Steps

1. Visually QA Analytics on:
   - Desktop landscape.
   - iPad/tablet portrait.
   - iPhone-sized portrait.
2. Confirm whether the analytics flow should stay as Option A Branch Map or evolve into a compact vertical mobile-specific version.
3. Confirm formula ownership:
   - Keep formulas in frontend for now, or move calculations into backend analytics endpoint.
4. Add backend tests once analytics logic moves server-side.
5. Add frontend tests for:
   - Date range comparison logic.
   - Rate calculations.
   - Ranking sort direction.
   - Off-track category filtering.
6. Confirm final copy for Action Needed and off-track badges.
7. Push `feature/analytics-core` to GitHub and open a PR when the user approves.

## Cautions

- Do not overwrite another developer's work from `develop`.
- Pull/rebase carefully before pushing.
- Do not use browser-native confirm dialogs for user-facing save/cancel flows unless specifically requested.
- Preserve role-based location restrictions:
  - Staff sees assigned location only.
  - Admin and super admin can filter all locations.
- Preserve mobile-first behavior. The user and client are highly sensitive to mobile breakage.

