# Judson Interns RSS Analytics Pages Handoff

Date: July 21, 2026
Purpose: detailed continuation context for a future development session in the same project

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
feature/additional-analytics-pages
```

Current HEAD when this handoff was written:

```text
7007539 Merge pull request #34 for cohort analytics
```

Branch state at handoff creation:

- Clean working tree.
- Branch points at the latest fetched `origin/develop`.
- No implementation changes have yet been made on this branch.
- The previous cohort analytics branch was merged through PR #34.
- The previous volume analytics branch was merged through PR #33.

Before changing code, run:

```bash
cd /Users/jagadeshkumarparanthaman/Projects/Judson-Interns-RSS
git status --short --branch
git fetch origin
```

Do not assume the configured desktop workspace is the repository. The active shell may open under `/Users/jagadeshkumarparanthaman/Documents/RSS`, but the actual repository used throughout this work is the path above.

## Immediate Pending Request

The next implementation task is:

1. Move **Cost and Margin** to the end of the analytics title/navigation menu, after **Staff**.
2. Keep visible loading feedback wherever analytics data is being fetched.
3. Do not place the loading message over or beside the Ready Set STEM brand/logo.
4. Replace the current global `Loading analytics...` pill with a compact animated loading symbol beside the analytics page title.

The menu order currently lives in:

```text
frontend/src/features/auth/ProtectedRoute.jsx
```

Current order:

```text
Overview
Volume and Trend
Conversion and Cohort
Location
Lead Source
Cost and Margin
Staff
```

Required order:

```text
Overview
Volume and Trend
Conversion and Cohort
Location
Lead Source
Staff
Cost and Margin
```

The current analytics loading element is in:

```text
frontend/src/pages/Analytics/Analytics.jsx
```

Current markup:

```jsx
{isLoading && (
  <p
    aria-live="polite"
    className="analytics-state analytics-state--loading"
    role="status"
  >
    Loading analytics...
  </p>
)}
```

Its CSS is near the top of:

```text
frontend/src/pages/Analytics/Analytics.css
```

It is currently `position: fixed; top: 1rem; left: 50%`, which is why it can appear in the global brand/header region. Remove that fixed loading pill behavior. The preferred result is a small spinner located next to the title rendered by `AnalyticsTitlePicker` in `ProtectedRoute.jsx`. Preserve accessible status text using visually hidden text or `aria-label="Loading analytics"`.

The authentication loading fallback in `ProtectedRoute.jsx` is separate:

```jsx
if (isLoading) {
  return <div className="route-loading">Loading...</div>;
}
```

Do not confuse authentication bootstrap loading with analytics data loading. The immediate request is about analytics data refreshes. Avoid a broad auth/layout rewrite unless visual testing proves it is also placing text over the logo.

A clean implementation may require lifting analytics loading state to the title area. Prefer a small, explicit mechanism over a global document query. Reasonable approaches include a lightweight analytics loading context in the protected layout, route-level outlet context, or a narrowly scoped custom event with cleanup. Whichever approach is chosen, ensure loading state resets on success, fallback success, failure, navigation, and unmount.

## Product and Analytics Model

Ready Set STEM tracks a family through this flow:

```text
Booked
├── Toured
│   ├── Enrolled
│   └── Churned
└── No Show
```

There are two distinct date models. Do not mix them.

### Volume analytics

Volume answers: **What activity occurred during the selected period?**

- Booked uses the booking/creation event date.
- Toured uses the toured event date.
- No Show uses the no-show event date.
- Enrolled uses the enrolled event date.
- Churned uses the churned event date.
- Status counts are event counts, not a mutually exclusive family distribution.
- Toured and No Show are downstream outcomes of Booked.
- Enrolled and Churned are downstream outcomes of Toured.

### Cohort analytics

Cohort answers: **What happened to families whose scheduled tour date falls inside the selected period?**

- Cohort membership is anchored to scheduled tour date.
- Later outcomes remain attached to that cohort even when they occur outside the selected period.
- Toured rate = Toured / Booked.
- No Show rate = No Show / Booked.
- Close rate = (Enrolled + Churned) / Toured.
- Conversion rate = Enrolled / Toured.
- Average days to enrollment = enrolled event date minus scheduled tour date, averaged across eligible enrolled records.

This distinction was added to overview section info icons in short bullet form. Keep wording short and formula-oriented.

## Implemented Routes

Routes are configured in:

```text
frontend/src/App.jsx
```

Implemented pages:

```text
/analytics/overview  -> Analytics view="overview"
/analytics/volume    -> Analytics view="volume"
/analytics/cohort    -> Analytics view="cohort"
```

Placeholder pages currently exist for:

```text
/analytics/locations
/analytics/lead-sources
/analytics/staff
/analytics/cost-margin
```

These placeholders should eventually become real pages. Empty routes were intentionally created so every overview link has a destination.

The analytics title is a dropdown in the page title banner. Detail pages show a back button to the previous page; overview does not.

## Main Files

Frontend:

```text
frontend/src/pages/Analytics/Analytics.jsx
frontend/src/pages/Analytics/Analytics.css
frontend/src/pages/Analytics/AnalyticsPlaceholder.jsx
frontend/src/features/analytics/analyticsApi.js
frontend/src/features/auth/ProtectedRoute.jsx
frontend/src/components/filters/TourFilterControls.jsx
frontend/src/features/tours/filterConfig.js
frontend/src/App.jsx
```

Backend:

```text
backend/apps/analytics/services.py
backend/apps/analytics/views.py
backend/apps/analytics/urls.py
backend/apps/tours/views.py
```

The analytics frontend first calls the backend cohort analytics endpoint. If that fails, it falls back to deriving analytics from tour data in the browser. Maintain both paths unless the user explicitly approves removing the fallback.

## Shared Filters and Permissions

All analytics pages built so far use the shared tour filter controls and include:

- Date
- Location
- Lead Source
- Staff

Cost basis was removed from analytics filters and should not return unless explicitly requested.

Staff filter requirements:

- The backend accepts staff IDs through `staff`, `assigned_staff`, or `assignedStaff`.
- Staff options are restricted by the selected locations.
- Changing the location selection clears the staff selection.
- Role/location restrictions must apply before analytics filters.
- Staff users are restricted to their assigned location.
- Admin/super-admin behavior must continue using the existing permission layer.
- Backend scoping begins with `filter_queryset_by_location` in `backend/apps/analytics/services.py`; never bypass it for new analytics sections.

When All Time is selected, the cohort workspace heading must say **All Time**, not **Selected period**.

## Analytics Overview

The overview is compact and organized in three sections without section numbers.

### Volume and Trend Analysis

Five cards in this order:

```text
Booked, Toured, No Show, Enrolled, Churned
```

Design rules:

- Card surfaces use the same base treatment.
- Status name and mini trend line carry the status color.
- Enrolled is visually emphasized as the star volume metric.
- Info icon explains that dates are event dates and Booked uses creation date.
- Link label is **Explore more**.

### Conversion and Cohort Analysis

Five metrics in this order:

```text
Toured Rate
Close Rate
No Show Rate
Conversion Rate
Avg. Days to Enroll
```

Design rules:

- Non-featured rate labels use purple.
- Conversion is green and receives the featured treatment.
- `days` should be much smaller than the numeric value.
- Info icons contain formulas rather than prose.
- Link label is **Explore more**.

### Performance Insights

Four cards in this order:

```text
Cost and Margin Analytics
Location Analytics
Lead Source Analytics
Staff Analytics
```

Note: the new pending menu-order request moves Cost and Margin to the end of the title/navigation dropdown. It does not necessarily change this overview card order unless the user confirms that separately.

Design rules:

- Navy banners and gold/yellow title text.
- Top performer row has a navy border/highlight.
- Rank numbers are gold.
- Cards share equal banner dimensions and overall heights.
- On mobile/portrait, cards stack as narrow collapsed rows with chevrons and expand on click.

## Volume and Trend Detail Page

The volume page is implemented locally and merged into `develop`.

### Volume and Event Share

- Uses a 100% stacked horizontal bar.
- Status legend appears below the bar.
- Each status shows Current, Previous, and Diff counts.
- Previous values are smaller than current values.
- Count difference badges use outcome-aware coloring:
  - Booked, Toured, Enrolled: positive is green; negative is red.
  - No Show, Churned: negative is green; positive is red.
- Event share percentages are based on all status events, not unique families.
- On small screens the same visual remains until 360 px; below that threshold controlled horizontal scrolling is allowed.

### Volume Trends

- Date navigator uses Older/Newer controls instead of uncontrolled mobile chart scrolling.
- Daily always groups daily; weekly always groups weekly; monthly groups monthly.
- Large date ranges show a window and are navigated through dates rather than silently changing aggregation.
- Booked is always displayed and is not in the status dropdown.
- Default timeline is Daily.
- The selectable statuses are Toured, No Show, Enrolled, and Churned.
- Dropdown supports multiple selection, Select all, and Clear.
- Dropdown closes when clicking outside.
- Clicked data labels hide when clicking outside.
- Current chart encoding:
  - Booked: line.
  - Toured: line.
  - No Show: bar.
  - Enrolled: line.
  - Churned: bar.

### Temporal Volume Rankings

- Status dropdown: Booked, Toured, No Show, Enrolled, Churned.
- Scope toggle: Selected period / All time.
- Direction: Highest volume / Lowest volume.
- Cards: Quarter, Month, Week of Month, Day of Month, Day of Week.
- Quarter/month/week are recurring calendar units, not year-specific labels.
- Day-of-month plot uses bars with x-axis labels 1, 5, 10, 15, 20, 25, 31.
- Displays five rows by default but the card scroll contains every value and count.
- Desktop cards have equal heights, even when some have fewer entries.
- Mobile/portrait cards are collapsed and show the top value beside the card name; clicking expands the plot and rankings.
- Mobile banner keeps status, time scope, and direction controls in one compact row, using icons where space is limited.

### Volume Performance Rankings

- Ranks Location, Lead Source, and Staff.
- Status dropdown includes All plus all five statuses.
- Scope toggle: Selected period / All time.
- Direction labels: Highest volume / Lowest volume.
- Its banner was explicitly aligned to the same component/style proportions as Temporal Volume Rankings.
- Responsive behavior should match the other ranking sections.

## Conversion and Cohort Detail Page

The cohort page was implemented in commit `377218d` and merged through PR #34.

### Cohort summary

- The same branch-map funnel is used at all screen sizes.
- Desktop/landscape uses a three-column composition.
- Mobile/portrait uses three compact rows rather than stacking every individual card vertically.
- Conversion Rate is the navy/gold featured metric.
- Operational cards include Average Days to Enroll and pending outcome counts.

### Conversion Trends

- Appears before Time to Progress.
- One combined chart supports four rates in the selector:
  - Toured Rate
  - Conversion Rate
  - No Show Rate
  - Closed Rate
- Default selected rates: Toured Rate and Conversion Rate.
- Dropdown color swatches, legend colors, and plotted colors must match.
- Timeline selector supports Daily, Weekly, Monthly.
- Date navigator mirrors the volume page.
- On click, show both the rate and the numerator/denominator used to calculate it.
- Requested visual encodings evolved; current intended result is:
  - Toured Rate: bar.
  - No Show Rate: curved line.
  - Conversion Rate: X markers connected by a dotted line.
  - Closed Rate: dotted line.

Confirm the live rendering before revising because several rapid styling requests were made in sequence.

### Temporal Conversion Rankings

This is deliberately different from temporal volume ranking.

- It ranks cohort quality/rates, not activity count.
- Temporal buckets refer to when the cohort entered, using scheduled tour date.
- Example: “Tuesday has the highest conversion” means cohorts with scheduled tours on Tuesday converted at the highest rate. It does not mean the most enrollment events happened Tuesday.
- No minimum cohort-size threshold was added, by explicit request.
- Banner styling and responsive behavior should match every other ranking banner.

### Time to Progress

Table rows:

```text
Booked -> Toured
Booked -> No Show
Toured -> Enrolled
Toured -> Churned
Booked -> Enrolled
```

Important semantic decision:

- The row is labeled Booked -> Enrolled for business readability.
- Its elapsed time starts at scheduled tour date and ends at enrolled event date.
- The info icon explicitly states this.

Highlighting:

- Booked -> Toured and Toured -> Enrolled have one gold star.
- Booked -> Enrolled has two gold stars.
- First column has a light navy fill.
- Average column has a different light navy family so it is visually distinct from the yellow interval heatmap.

Eligibility labels:

- Say `eligible`, not `completed` or `pending`.
- Counts can differ from the cards because the table includes only records with both required milestone timestamps and a usable elapsed duration.

Adaptive intervals:

- For selected ranges under 20 days, use:

```text
0-2, 3-5, 6-10, 11-20, 20+
```

- Otherwise use:

```text
0-7, 8-14, 15-30, 31-60, 60+
```

Mobile/portrait behavior:

- First and last columns are sticky.
- Middle interval columns scroll horizontally according to available width.
- Cell text must not overflow.
- The word `days` may be removed from interval headers on small screens.

### Cohort Performance Rankings

Banner title:

```text
Cohort Performance Rankings
```

Metric options and order:

```text
Enrollments
Conversion Rate
Average Days to Enrollment
Toured Rate
Close Rate
```

- Default metric is Conversion Rate.
- Contribution Margin was removed.
- For Average Days to Enrollment, do not show a formula/detail line under each ranking item.
- Scope toggle supports Selected period / All time.
- Direction remains Best performing / Least performing because metric direction varies.
- Location, Lead Source, and Staff cards use equal-height desktop layouts.
- Mobile/portrait follows the same collapsed-card pattern as Temporal Volume Rankings: compact summary row, top item adjacent to title, expand to reveal full ranking.

## Loading, Interaction, and Responsive Conventions

- Dropdowns must close when the user clicks outside, not only when the trigger is clicked again.
- Data point callouts must also close on outside click.
- Avoid horizontal scrolling where a date navigator can present a stable chart window.
- At very narrow thresholds, controlled scroll is acceptable when preserving the visual is more useful than compressing it beyond readability.
- The Ask RSS assistant is movable so it does not permanently hide info icons.
- Info tooltips should be short, crisp, and broken into separate lines/bullets.
- Use formulas where a metric definition is clearer than prose.
- Loading indicators should be local to the thing loading. Do not cover the brand name or cause the page title to jump.
- Preserve existing content during filter refresh where possible and show a title-level spinner rather than replacing the entire dashboard.

## Branding and Visual System

- Dark official navy and gold/yellow are the shared ranking-banner palette.
- White cards use soft gray/blue borders and subtle shadow.
- Status colors:
  - Booked: blue.
  - Toured: yellow/gold.
  - No Show: orange.
  - Enrolled: green.
  - Churned: red.
- Enrolled and Conversion are the primary/star metrics in overview contexts.
- All ranking banners across volume and cohort pages should share the same height, grid proportions, control height, padding, typography scale, border, toggle design, and mobile collapse rules.
- Avoid wrapping ranking/banner titles. Reduce type scale responsively first.

## Backend Details

Primary service:

```text
backend/apps/analytics/services.py
```

Notable functions include:

```text
base_queryset
apply_filters
count_cohort_progress
volume_event_timestamp
build_time_to_progress
build_volume_trend_data
build_volume_heatmap
build_volume_calendar_data
build_rates
average_days_to_enroll
pending_counts
build_trend_data
build_ranking
build_volume_performance_ranking
cohort_analytics
```

The backend response currently includes selected and all-time ranking/trend datasets, staff options, time-to-progress data, volume trend data, volume calendar data, volume performance rankings, counts, rates, deltas, pending outcomes, and average days.

No schema migration was required for the volume/cohort analytics work.

## Export Discussion — Not Yet Implemented

The user asked whether export can be dynamic. Agreed product direction:

- **Current view** export: export only the selected filters, status/metric, scope, direction, timeline, and visible configuration.
- **All views** export: produce a longer report with all statuses/metrics/scopes one below another.

This was a design discussion only. Do not assume export exists. If implemented, put the export mode choice in the UI rather than silently exporting hidden alternatives.

## Deployment Context

The latest Railway deployment became queued with the message that it was waiting due to upstream GitHub issues. GitHub simultaneously showed the deployment as active. The user removed the queued Railway deployment and asked how to retrigger it.

Deleting the feature branch after merge should not break deployment when Railway is configured to deploy `develop`; the merge commit remains on `develop`.

If deployment needs retriggering and Railway does not show “Deploy latest commit”:

1. Confirm the service source branch is `develop`.
2. Use Railway service settings to reconnect/redeploy the source if available.
3. As a safe GitHub-side trigger, make an empty commit on a temporary branch based on latest `develop`, open/merge a PR, or use the Railway CLI if installed and authenticated.
4. Do not force-push or rewrite `develop`.

See also:

```text
docs/railway-deploy.md
```

## User Git Shorthand

The user established two workflow commands.

### `kr commit`

Interpret as:

1. Check and review the working tree.
2. Run relevant validation.
3. Commit locally.
4. Fetch/pull the latest GitHub `develop`.
5. Merge `origin/develop` into the working feature branch.
6. Analyze and resolve conflicts carefully.
7. Re-run validation after the merge.
8. Push the feature branch to GitHub as a remote branch.
9. Provide a PR title and an elaborate PR description.
10. The user creates and merges the PR and then says `done`.

Do not push directly to `develop` unless the user explicitly and unambiguously asks for that exact destructive workflow. The established pattern is a remote feature branch for a user-created PR.

### `kr cleanup`

Interpret as:

1. Check for uncommitted work.
2. Do not discard uncommitted user work.
3. Fetch the latest GitHub `develop`.
4. Switch/update local `develop` safely.
5. Create a clean new branch from latest `origin/develop`.
6. Branch names should use the `feature/...` pattern, per the user’s explicit preference.

The current `feature/additional-analytics-pages` branch was created through this cleanup workflow.

## Validation

Frontend:

```bash
cd /Users/jagadeshkumarparanthaman/Projects/Judson-Interns-RSS/frontend
npm run lint
npm run build
```

Backend validation depends on the project environment, but at minimum run the relevant Django checks/tests if backend code changes.

Before committing:

```bash
cd /Users/jagadeshkumarparanthaman/Projects/Judson-Interns-RSS
git diff --check
git status --short
git diff --stat
```

Visually verify at these classes of viewport:

- Wide desktop/landscape.
- Tablet portrait.
- Mobile around 390 px.
- Narrow mobile at 360 px.
- Below 360 px when a component has an explicit scroll threshold.

Also verify:

- All analytics dropdowns close on outside click.
- Date navigator Older/Newer states are correct.
- Staff/location permissions are respected.
- Selected period and All time labels match the active scope.
- Loading spinner appears beside the page title and nowhere over the brand.
- The analytics title menu ends with Staff, then Cost and Margin.

## Recommended Next Sequence

1. Implement the pending analytics menu reorder.
2. Implement title-level analytics loading state and remove the fixed loading pill.
3. Run lint/build and visually verify loading during initial load and filter changes.
4. Build the remaining Location Analytics page.
5. Build Lead Source Analytics.
6. Build Staff Analytics with permission-aware data.
7. Build Cost and Margin Analytics last.
8. Add Current view / All views export only after the remaining page content is stable.

## Continuation Prompt for the New Chat

Use this concise prompt after attaching or referencing this file:

```text
Read docs/handoff-2026-07-21-analytics-pages.md completely. Continue on feature/additional-analytics-pages. First implement the Immediate Pending Request: move Cost and Margin after Staff in the analytics menu and replace the fixed global analytics loading message with an accessible spinner beside the analytics page title. Preserve existing role/location filtering and responsive behavior. Validate lint, build, and git diff before reporting back.
```
