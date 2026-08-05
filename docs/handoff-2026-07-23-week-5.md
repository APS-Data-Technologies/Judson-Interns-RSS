# Ready Set STEM Week 5 Handoff

**Date:** July 23, 2026
**Purpose:** Detailed continuation context for the next development task

## Start Here

Use this repository, not the saved desktop workspace directory:

```text
/Users/jagadeshkumarparanthaman/Projects/Judson-Interns-RSS
```

GitHub:

```text
https://github.com/APS-Data-Technologies/Judson-Interns-RSS
```

Current local branch:

```text
feature/analytics-engine-follow-up
```

Current HEAD and `origin/develop`:

```text
85d080f Merge pull request #39 from APS-Data-Technologies/feature/export
```

This branch was created through `kr cleanup` from the latest `origin/develop`. It currently has no tracked changes.

## Working Tree and Preservation Rules

The following local artifacts are intentionally untracked:

```text
database/backups/
docs/handoff-2026-07-22-analytics-follow-up.md
docs/week-4-report.md
output/
tmp/
```

Preserve them. In particular:

- Never stage, delete, move, or modify `database/backups/`.
- `output/` contains the generated Analytics Engine PDF and editable Week 5 Word report.
- `tmp/` contains document/PDF rendering and QA artifacts.
- Do not assume untracked files are disposable.

## Recent Git State

The main Week 5 work was merged through PR #39:

```text
b57e31f feat: expand analytics insights and governance
85d080f Merge pull request #39 from APS-Data-Technologies/feature/export
```

Earlier merged work in the same reporting window includes:

- PR #31-32: analytics overview and volume foundations
- PR #33: Volume and Trend analytics
- PR #34: Conversion and Cohort analytics
- PR #35: Location, Lead Source, and Staff analytics
- PR #36-37: Cost Basis, financial overview, permissions, and analytics refinements
- PR #38: complete Costs & Margin analytics
- PR #39: executive summaries, drill-through, exports, global search, analytics modularization, governance, and documentation

## Current Analytics Product

Analytics navigation contains:

1. Overview
2. Volume and Trend
3. Conversion and Cohort
4. Location
5. Lead Source
6. Staff
7. Costs & Margin

### Overview

- Selected-period operational performance
- Rates and previous-period comparisons
- Concise performance signals
- Links to detailed analysis
- Permission-aware Staff and Costs & Margin cards

### Volume and Trend

- Booked, Toured, No Show, Enrolled, and Churned volumes
- Current-versus-previous comparison
- Event shares
- Trend and calendar views
- Temporal rankings by quarter, month, week, and day
- Location, lead-source, and staff rankings

### Conversion and Cohort

- Tour, conversion, no-show, and close rates
- Average days to enroll
- Cohort-based progress from scheduled families
- Time-to-progress and temporal rankings
- Off-track and unresolved follow-up signals

### Location, Lead Source, and Staff

- Volume and rate performance
- Current and comparison-period values
- Small color-coded changes beside actual values
- Peak periods and trend sparklines
- Positives and needs-attention signals
- Related-entity performance where appropriate
- Drill-through into authorized family-level details

Staff Analytics intentionally does not show cross-entity lead-source performance.

### Costs & Margin

Financial analysis is monthly and excludes the incomplete current month.

Implemented content:

- Revenue
- Costs
- Contribution margin
- Margin percentage
- Comparison months
- Monthly financial trend
- Cost efficiency trend
- Location performance
- Activity volume, conversion, financials, and efficiency in the same business context

Financial formulas:

```text
Contribution Margin = Revenue - Costs
Margin % = Contribution Margin / Revenue
Cost Efficiency = Cost / selected activity volume
```

The activity selection controls the corresponding efficiency metric.

## Executive Summaries

Detailed analytics pages, except Overview, include a short rule-based Executive Summary.

The summary is intended for leadership to make decisions without reading every visual. It can include:

- Key figures
- What is working
- What needs attention
- Recommended actions
- Material alerts

The summary:

- Is deterministic and rule-based
- Uses current filters and comparison months
- Respects role and data permissions
- Is deterministic and rule-based
- Should remain concise and avoid repeating every visual

Rules are primarily in:

```text
backend/apps/analytics/executive.py
docs/analytics-engine/executive-summary-rules.md
```

## Drill-through

Drill-through is implemented across analytics.

- Laptop and landscape screens use a right-side drawer.
- Mobile and portrait screens use the mobile presentation.
- Results inherit active time, location, lead-source, staff, and metric context.
- Backend filtering enforces the requesting user's scope.
- The response is capped and reports when results are truncated.

Primary files:

```text
backend/apps/analytics/views.py
frontend/src/pages/Analytics/AnalyticsActions.jsx
frontend/src/features/analytics/analyticsApi.js
```

## Export

The guided export flow asks:

1. Current analytics page or all analytics pages
2. Current selection/view or all achievable analytics views
3. Visual report or underlying data
4. PDF or Excel

Important distinction:

- PDF is a visual capture of the designed analytics page.
- Excel contains editable underlying tables.

The export button lives in the page title bar and becomes icon-only on small screens.

Primary files:

```text
backend/apps/analytics/exports.py
backend/apps/analytics/views.py
frontend/src/pages/Analytics/AnalyticsActions.jsx
frontend/src/features/analytics/analyticsApi.js
```

Browser PDF generation uses:

- `html2canvas-pro`
- `jspdf`

Backend Excel/PDF support adds the required Python packages in `backend/requirements.txt`.

## Global Search

A distinct search bar exists inside the chat assistant.

Search hierarchy:

1. Pages
2. Sections
3. Relevant filters/status options
4. Families

Behavior:

- Suggestions appear while typing.
- Results route directly to the relevant page.
- Status searches can route to Tours, Pipeline, or Analytics with the relevant filter selected.
- Family lookup uses the backend search endpoint for speed and permissions.
- Search results respect user role and assigned-location access.

Primary files:

```text
backend/apps/analytics/search.py
frontend/src/features/search/globalSearchApi.js
frontend/src/components/chat/ChatAssistant.jsx
```

## Analytics Engine Administration

The Analytics Engine administration capability is implemented but intentionally hidden from the visible UI.

Protected route:

```text
/admin/analytics-engine
```

Backend endpoint:

```text
/api/analytics/engine/
```

Implemented capabilities:

- Live-source freshness
- Record counts
- Database/system health
- Business metric definitions
- Role/permission matrix
- Retention and purge safeguards
- Validation and export activity history
- Super-Admin-only manual validation

Do not expose the page in Settings, Admin tabs, chat search, or navigation unless the user explicitly approves activation.

The page is still imported and routed in:

```text
frontend/src/App.jsx
frontend/src/pages/Admin/AnalyticsEngineAdmin.jsx
```

### Current Data-Operations Truth

- Analytics calculates live from operational tables.
- There is no separate analytics warehouse or scheduled refresh pipeline.
- "Validate now" checks current connectivity and live-source status; it does not reload data.
- No automatic analytics purge or retention job exists.
- Purge remains disabled until retention, approval, correction, backup, and restoration policies are approved.
- Database backup handling remains separate and must never be changed from the Analytics Engine page.

### AnalyticsOperation Migration

The merged code adds:

```text
backend/apps/analytics/migrations/0001_initial.py
```

It creates `AnalyticsOperation`, which records validation and export activity.

Apply migrations in a development or deployment environment before testing the endpoint:

```bash
backend/venv/bin/python backend/manage.py migrate
```

Do not run migrations against an unknown production database without confirming the environment.

## Permissions Contract

Do not conflate analytics access with Cost Basis management.

### Staff

- Operational analytics only
- Limited to assigned location
- Cannot access Staff Analytics
- Cannot access Costs & Margin Analytics
- Cannot retrieve restricted financial/staff sections through the API
- Cannot access Analytics Engine administration

### Admin

- Organization-level operational analytics
- Staff Analytics
- Costs & Margin Analytics
- Read access to Analytics Engine status through the protected endpoint
- Cannot manage Cost Basis records
- Cannot run Analytics Engine validation

### Super Admin

- Full analytics access
- Cost Basis management
- Analytics Engine status
- Manual Analytics Engine validation

Relevant enforcement:

```text
frontend/src/App.jsx
frontend/src/features/auth/RoleRoute.jsx
frontend/src/pages/Analytics/Analytics.jsx
backend/apps/analytics/services.py
backend/apps/analytics/views.py
backend/apps/analytics/tests/test_engine_admin.py
```

`RoleRoute` must continue forwarding parent outlet context. Removing that behavior breaks nested analytics loading state.

## Responsive Contract

Analytics uses two layout modes:

1. Mobile mode for phones and portrait tablets up to 1180 px wide.
2. Laptop mode for landscape tablets and desktop/laptop screens.

There is no hybrid tablet mode.

Expected viewport behavior:

- 390 x 844: mobile
- 768 x 1024: mobile/portrait
- 1024 x 1366: mobile/portrait
- 1024 x 768: laptop/landscape

Rules:

- Portrait tablets follow the phone composition.
- Landscape tablets follow the laptop composition.
- Avoid document-level horizontal overflow.
- Keep touch targets usable.
- Cards may remain in one row until their defined threshold, then use horizontal scrolling or the established mobile stack.
- Orientation changes must not leave mixed layout state.

Primary files:

```text
frontend/src/pages/Analytics/Analytics.css
frontend/src/components/layout/TitleBar/TitleBar.css
frontend/src/components/layout/AppShell/AppShell.css
frontend/src/components/layout/BottomNavigation/BottomNavigation.css
frontend/src/components/layout/TopBanner/TopBanner.css
```

## Analytics Backend Structure

The prior monolithic service was modularized:

```text
backend/apps/analytics/core.py
backend/apps/analytics/metrics.py
backend/apps/analytics/financial.py
backend/apps/analytics/rankings.py
backend/apps/analytics/executive.py
backend/apps/analytics/exports.py
backend/apps/analytics/search.py
backend/apps/analytics/operations.py
backend/apps/analytics/services.py
```

Responsibilities:

- `core.py`: base querysets, filtering, dates, scopes
- `metrics.py`: activity, cohort, rate, and trend calculations
- `financial.py`: monthly financial and cost-efficiency calculations
- `rankings.py`: temporal and entity rankings
- `executive.py`: deterministic leadership summaries
- `exports.py`: Excel/PDF export preparation
- `search.py`: global search and filtered destinations
- `operations.py`: health, definitions, retention status, validation history
- `services.py`: orchestration and API response construction

Keep calculations centralized. Do not add page-specific duplicate formulas in React unless they are explicitly safe display-only fallbacks.

## Analytics Documentation

CEO-oriented summary:

```text
docs/analytics-engine.md
```

Detailed supporting documentation:

```text
docs/analytics-engine/README.md
docs/analytics-engine/architecture-and-lineage.md
docs/analytics-engine/date-and-cohort-rules.md
docs/analytics-engine/executive-summary-rules.md
docs/analytics-engine/gap-analysis.md
docs/analytics-engine/governance.md
docs/analytics-engine/metric-catalog.md
docs/analytics-engine/operations.md
docs/analytics-engine/permissions.md
```

The executive document should remain short, business-focused, and low in technical detail. Detailed implementation information belongs in the supporting documents.

## Generated Reports

### Analytics Engine PDF

```text
output/pdf/ready-set-stem-analytics-engine.pdf
```

This is a generated executive artifact and is currently untracked.

### Editable Week 5 Status Report

```text
output/docx/RSS_Week_5_Status_Report_Editable.docx
```

It was recreated from:

```text
/Users/jagadeshkumarparanthaman/Downloads/RSS_Week_4_Status_Report.pdf
```

The editable Word version:

- Covers July 17-23, 2026
- Preserves the four-page Week 4 table-led visual structure
- Passed render and accessibility checks
- Is uploaded to Google Docs at:

```text
https://docs.google.com/document/d/1D5XluRAvb-vkKgUK7p6eLNcvD35vKWFgRYBWMtEJc4s/edit
```

The source PDF must remain unchanged.

## Validation

Frontend:

```bash
cd /Users/jagadeshkumarparanthaman/Projects/Judson-Interns-RSS/frontend
npm run lint
npm run build
```

Backend test discovery must use explicit modules because root discovery may report zero tests:

```bash
cd /Users/jagadeshkumarparanthaman/Projects/Judson-Interns-RSS
DATABASE_URL='sqlite:///:memory:' backend/venv/bin/python backend/manage.py test \
  apps.accounts.tests.test_authentication \
  apps.analytics.tests.test_engine_admin \
  apps.analytics.tests.test_financial_summary \
  apps.leads.tests.test_lead_source_api \
  apps.reports.tests.test_cost_basis_api \
  apps.sites.tests.test_location_api \
  apps.tours.tests.test_home_summary \
  apps.tours.tests.test_tour_workflow
```

Repository checks:

```bash
git diff --check
git status --short
git diff --stat
```

Latest validation passed:

- Explicit Django backend test modules
- Frontend ESLint
- Vite production build
- Django migration consistency
- `git diff --check`

The existing Vite warning about a JavaScript chunk over 500 kB does not fail the build.

## User Git Shorthand

### `kr commit`

This means the complete workflow:

1. Inspect branch, HEAD, status, and diff.
2. Preserve all unrelated user and untracked work.
3. Run relevant backend/frontend validation.
4. Stage only intended product files.
5. Commit locally.
6. Fetch the latest GitHub state.
7. Merge `origin/develop` into the feature branch.
8. Resolve conflicts carefully.
9. Re-run validation after the merge.
10. Push the feature branch.
11. Provide a PR title and detailed PR description.

Never push directly to `develop` unless the user explicitly requests it.

### `kr cleanup`

1. Check for uncommitted work.
2. Preserve user work and all intentional untracked files.
3. Fetch `origin`.
4. Switch to local `develop`.
5. Fast-forward with:

   ```bash
   git pull --ff-only origin develop
   ```

6. Create a clean new `feature/...` branch from the latest `origin/develop`.
7. Confirm branch, HEAD, and status.

## Recommended Next Steps

1. Run production/deployment migration validation for `AnalyticsOperation`.
2. Perform user acceptance testing across all seven analytics views.
3. Reconcile headline metrics against drill-through and Excel exports.
4. Test Admin, Super Admin, and Staff permissions with realistic accounts.
5. Verify PDF downloads and Excel exports in the deployed browser environment.
6. Run responsive regression at phone, portrait-tablet, landscape-tablet, and desktop sizes.
7. Decide whether and when to expose Analytics Engine administration.
8. Define formal retention, correction, purge approval, backup frequency, and restoration policies.
9. Consider code splitting for analytics/export dependencies after functional validation.

## Continuation Instruction

Start every new task by:

1. Working from the repository path in this handoff.
2. Reading this document completely.
3. Inspecting branch, HEAD, and status.
4. Preserving `database/backups/` and all other intentional untracked artifacts.
5. Confirming whether the requested work affects hidden Analytics Engine administration, permissions, financial definitions, responsive behavior, exports, or generated reports before editing.
