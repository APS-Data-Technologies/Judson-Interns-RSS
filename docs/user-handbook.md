# Ready Set STEM User Training Handbook

**System:** Ready Set STEM (RSS) internal workspace
**Audience:** Staff, Admins, Super Admins, managers, and leadership
**Training edition:** July 30, 2026

## 1. Purpose of this handbook

This handbook is designed for instructor-led training, new-user onboarding, and day-to-day reference. It explains:

- what every major area of RSS is for;
- what each screen, control, card, chart, and workflow represents;
- what each role can see and change;
- how to complete common tasks step by step;
- how analytics formulas and business rules work;
- why an analytics total may differ from its drill-through row count;
- how mobile/portrait and laptop/landscape layouts behave;
- how exports, search, account security, and administration work;
- the system's terminology, assumptions, and known boundaries.

RSS is an internal application for managing prospective-family tours from booking through enrollment or churn. It combines daily operational work, pipeline management, analytics, financial reporting, and role-aware administration.

This is not a developer or deployment guide. Technical setup, source-code maintenance, and environment configuration belong in separate implementation documentation.

## How to use this handbook

New users should complete the sections in this order:

1. Learn their role and permissions.
2. Learn the status workflow and terminology.
3. Practice signing in and changing a password.
4. Practice Home, Tours, and Pipeline tasks.
5. Learn search and RSS Assistant.
6. Learn the analytics concepts that apply to their role.
7. Admins and Super Admins complete the administration modules.

Trainers should use a non-production training account and demonstration records. Do not create fictional families in Production.

## 2. Roles and permissions

Permissions are enforced throughout the system. A hidden link or manually entered address does not bypass authorization.

| Capability | Staff | Admin | Super Admin |
|---|---:|---:|---:|
| Sign in, sign out, change own password | Yes | Yes | Yes |
| View Home, Tours, Pipeline | Assigned location | Organization | Organization |
| Create and update tours | Assigned location | Organization | Organization |
| Operational analytics | Assigned location | Organization | Organization |
| Location and Lead Source Analytics | Assigned location | Organization | Organization |
| Staff Analytics | No | Yes | Yes |
| Costs & Margin Analytics | No | Yes | Yes |
| Manage locations | No | Yes | Yes |
| Manage lead sources | No | Yes | Yes |
| Manage users and roles | No | No | Yes |
| Manage cost/revenue records | No | No | Yes |

### Staff

A Staff user must be assigned to one location. Tour lists, pipeline records, family search, drill-through, and analytics are restricted to that location. Staff cannot select another location.

### Admin

An Admin can work across the organization, manage locations and lead sources, and view Staff and Costs & Margin Analytics. An Admin cannot manage user accounts or cost/revenue records.

### Super Admin

A Super Admin has organization-wide access and can additionally manage users, roles, location assignments, and cost/revenue records.

## 3. Core records and terminology

### Family

The household or prospective customer associated with a tour. Current stored contact fields are family name, email, phone, and notes.

### Tour

The main operational record. A tour connects:

- a family;
- a location;
- a lead source;
- the staff member who created/owns the tour;
- a child grade;
- a scheduled tour date and time;
- a current status.

### Tour event

An immutable workflow-history entry recording a status, timestamp, updating user, and optional notes. The tour's current status represents its latest operational state; event history explains how it reached that state.

### Lead source

Where the family inquiry originated, such as a referral, event, online search, or campaign. Lead sources may be active or inactive.

### Location

An RSS site with a name, address, city, state, ZIP code, phone, and active/inactive state.

### Assigned staff

The user responsible for the tour. Staff users are tied to a location; Admins and Super Admins are not assigned to a location in the user record.

### Cost basis

A monthly revenue or expenditure record for one location. Only one active record combination is allowed for each location, reporting month, and cost type.

### Current status

The tour's present workflow status. It is not necessarily the event counted by an analytics period.

### Contribution date

The date on which a record contributed to a selected KPI. For example, an Enrolled KPI uses the enrollment event date, while a cohort rate may use the original scheduled-tour date to determine eligibility.

### Contributing KPI

The metric for which the row is evidence, such as Booked, Toured, No Show, Enrolled, or Churned.

## 4. Status model and business workflow

RSS stores these statuses:

| Stored status | User-facing meaning | Typical next action |
|---|---|---|
| Scheduled | Booked: a future or pending tour exists | Record Toured or No Show after the appointment |
| Toured | The family completed the tour | Record Enrolled or Churned when the outcome is known |
| No Show | The family did not attend | Follow the approved re-engagement process |
| Enrolled | The family reached enrollment | No further pipeline movement |
| Churned | The opportunity did not proceed | No further pipeline movement |

The primary pipeline presents:

```text
Booked → Toured → Enrolled
    └──→ No Show
          Toured → Churned
```

Operationally:

- Booked means a scheduled tour exists.
- Toured means the family completed the tour.
- No Show means the scheduled family did not attend.
- Enrolled means the family reached enrollment.
- Churned means the opportunity did not proceed or was lost after progress.

Status transitions create event history. Do not rewrite history simply to make a report look correct; correct the operational record according to approved business procedures.

## 5. Application shell and navigation

### Laptop or landscape mode

Landscape tablets, laptops, and desktop monitors use the laptop composition. Navigation appears in the persistent application shell, and wide tables or multi-card sections use available horizontal space.

### Mobile or portrait mode

Phones and portrait tablets use the mobile composition. Navigation moves to mobile controls, sections become more compact, and wide content may scroll within its own section.

The product intentionally has only two responsive modes:

1. mobile/portrait;
2. laptop/landscape.

Orientation is part of the decision. A `1024 × 1366` portrait viewport uses mobile composition; a `1024 × 768` landscape viewport uses laptop composition.

### Page title banner

The title banner identifies the current workspace. Analytics pages also place Export in this banner. On small screens, text may collapse to an icon to preserve usable space.

### Information icons

Information icons explain a metric, section, or workflow. Only one explanatory message should be open at a time. On small screens, the message must remain visible within the viewport rather than being clipped behind fixed navigation.

## 6. Authentication and account use

### Sign in

1. Open the RSS login page.
2. Enter the email address assigned to your account.
3. Enter your password.
4. Select **Sign in**.
5. RSS opens the Home workspace after successful authentication.

Email addresses are normalized to lowercase. Authentication tokens expire according to the configured server policy.

### Forgot password

1. Select **Forgot password** on the login page.
2. Enter the account email.
3. Submit the request.
4. Open the password-reset link delivered through the configured email process.
5. Enter and confirm the new password.

Reset links are one-time and time-limited. The database stores a digest of the token, not the raw reset token.

### Change your password

1. Open **Settings**.
2. Expand **Update password**.
3. Enter the current password.
4. Enter a new password of at least eight characters.
5. Confirm the new password.
6. Select **Update password**.

### Sign out

Open **Settings** and select **Logout**. This invalidates the current session token.

## 7. Home dashboard

Home is the daily operational starting point.

### Filters

Home supports operational filters but intentionally locks its date meaning:

- today's booked tours;
- yesterday's no-shows.

To work with other dates, use Tours.

Staff see their assigned location. Admins and Super Admins can use organization-level selections.

### Today summary

The summary communicates the day's tour workload. Cards are actionable entry points into relevant records.

### Action Needed

Action Needed identifies unresolved operational follow-up, such as:

- a completed tour without an enrollment or churn outcome;
- a booked tour whose next outcome needs attention;
- an overdue outcome based on observed average time to progress.

These are workflow signals, not automatic changes to a tour.

### Use Home for daily follow-up

1. Open Home.
2. Review today's booked tours.
3. Review yesterday's no-shows.
4. Open Action Needed.
5. Select a family to inspect details.
6. Edit or move the tour only after confirming the correct outcome.

## 8. Tours workspace

Tours is the complete operational record list.

### Filters and controls

Depending on the page context, controls include:

- sort order;
- date or date range;
- family search;
- location;
- lead source;
- assigned staff;
- status;
- category.

**Select all** represents all available authorized values and should be displayed as “All,” not as a long list. **Clear** removes the selection for that filter. Staff location is locked.

### Tour cards and detail pane

A tour card summarizes the family, scheduled time, location, status, lead source, and assigned staff. In wider layouts, selecting a record can open a detail pane. In mobile layouts, details use the dedicated record page.

### Create a tour

1. Open Tours.
2. Select **Add tour** or use the RSS Assistant shortcut.
3. Enter the family name.
4. Add contact email and/or phone.
5. Select the location.
6. Select the lead source.
7. Enter child grade when known.
8. Choose the scheduled date and time.
9. Add notes if needed.
10. Save.

Rules:

- Staff can create records only within their authorized location.
- The signed-in user becomes the assigned staff member.
- Staff can select only their assigned location.
- Required values must be completed before saving.
- Unsaved-change protection warns before leaving a changed form.

### View a tour

1. Find the family in Tours, Pipeline, Home, or global search.
2. Select the view/details action.
3. Review:
   - Tour Info;
   - Family Contact;
   - Event History.

### Edit a tour

1. Open the tour.
2. Select **Edit**.
3. Update permitted fields.
4. Save.
5. Confirm the changed values and event history.

## 9. Pipeline

Pipeline visualizes the current operational status of tours.

### Card view

Card view shows one selected status at a time. Use the status tabs to switch between Booked, Toured, No Show, Enrolled, and Churned.

### Board view

Board view shows the pipeline as columns. On supported laptop/landscape layouts, cards may be dragged between valid stages. Touch users use the explicit move controls.

### Move a tour

1. Locate the tour.
2. Select the move control or drag the card to a valid next stage.
3. Choose the target outcome.
4. Confirm the move.
5. Wait for the saved status to appear.

RSS validates allowed next-stage actions; it does not treat every status as freely interchangeable.

### Filters

Pipeline filters use the same authorization and “All” behavior as Tours. Search and filters narrow the board; they do not change the stored status.

## 10. RSS Assistant and global search

RSS Assistant combines navigation search, authorized family search, direct shortcuts, and simple help responses.

### Search

1. Open RSS Assistant.
2. Type at least two characters.
3. Review grouped results:
   - Pages;
   - Sections;
   - Statuses;
   - Families.
4. Select a result.

The selected result routes directly to the destination. Status results may offer Tours, Pipeline, or Analytics destinations with the relevant filter applied.

Family results respect role and assigned-location permissions.

### Ask a question

Use the same composer to ask a supported workspace question. The assistant provides deterministic navigation and help responses; it should not be treated as a free-form generative business analyst.

### Shortcuts

Shortcuts are centrally defined and role-aware; they are not user-saved favorites. Examples include:

- Today's tours;
- Review no-shows;
- View the enrollment pipeline;
- Review enrollment performance;
- Compare conversion trends;
- Manage locations;
- Manage users for Super Admins.

Selecting a navigation shortcut goes directly to the intended page rather than reopening the chat.

## 11. Analytics common controls

Analytics contains:

| Page | Primary question | Access |
|---|---|---|
| Overview | What is the overall performance for the selected period? | All roles within authorized scope |
| Volume and Trend | What activity happened, and when? | All roles within authorized scope |
| Conversion and Cohort | What happened to families booked in the selected period? | All roles within authorized scope |
| Location | How do locations compare? | All roles; Staff remain assigned-location scoped |
| Lead Source | Which inquiry sources produce volume and outcomes? | All roles within authorized scope |
| Staff | How does assigned-staff performance compare? | Admin and Super Admin |
| Costs & Margin | What are revenue, costs, margin, and efficiency? | Admin and Super Admin |

### Period

The selected period is inclusive. When a comparison is enabled, the previous period normally has the same number of days and ends one day before the current period begins.

### Entity filters

Location, lead source, and staff filters narrow the authorized dataset. Selecting all authorized values displays “All locations,” “All lead sources,” or “All staff.”

### Current period versus previous period

- **Current value:** value calculated for the selected period.
- **Previous value:** value calculated for the immediately preceding comparable period.
- **Difference:** current minus previous.
- **Difference %:** `(current − previous) ÷ previous × 100`.

When the previous value is zero, percentage change is not mathematically meaningful and may display as unavailable.

### All-time controls

An All Time toggle changes applicable rankings or visuals to the full authorized history. Drill-through context must say **All Time** and omit a misleading previous-period comparison.

### Executive Summary

Detailed pages provide deterministic, rule-based summaries. They reflect current filters and may identify:

- key figures;
- positive signals;
- needs-attention signals;
- recommended operational actions.

The summary is deterministic and rule-based and does not replace professional judgment.

## 12. Analytics formulas and event logic

### Percentage helper

```text
Rate = Numerator ÷ Denominator × 100
```

If the denominator is zero, the rate is unavailable rather than zero.

### Booked volume

Count of tours created/booked during the selected event period. The booked contribution timestamp is the tour creation time, which is also when the initial Scheduled event is created.

### Toured volume

Count of first qualifying toured events occurring within the selected event period.

### No-show volume

Count of first qualifying no-show events occurring within the selected event period.

### Enrolled volume

Count of first qualifying enrollment events occurring within the selected event period.

### Churned volume

Count of first qualifying churn events occurring within the selected event period.

### Toured rate

```text
Toured Rate = Toured cohort tours ÷ Booked cohort tours × 100
```

### No-show rate

```text
No-show Rate = No-show cohort tours ÷ Booked cohort tours × 100
```

Lower is generally favorable.

### Conversion rate

```text
Conversion Rate = Enrolled cohort tours ÷ Toured cohort tours × 100
```

### Close rate

```text
Close Rate = (Enrolled + Churned) cohort tours ÷ Toured cohort tours × 100
```

Close rate measures whether toured opportunities reached a recorded final outcome. It is not the same as enrollment success.

### Average days to enroll

```text
Average Days to Enroll =
Average(first enrollment event date − scheduled tour date)
```

Only eligible tours that reached enrollment contribute. If source data contains an enrollment date before its scheduled date, the current calculation does not silently discard it; users should correct the underlying operational data.

### Time-to-progress

Time-to-progress calculates elapsed days for transitions such as:

- Booked → Toured;
- Booked → No Show;
- Toured → Enrolled;
- Toured → Churned.

For Booked → Toured and Booked → No Show, elapsed time starts at record creation. For Booked → Enrolled, the dedicated calculation starts at the scheduled tour date. Toured transitions start at the first qualifying toured event. The chart groups non-negative elapsed values into defined day buckets and shows average elapsed time when eligible records exist.

### Pending follow-up

Pending signals are calculated from tours that have not reached an expected next/final outcome. When a reliable average-days benchmark exists, records older than that benchmark can be marked as requiring attention.

## 13. Overview Analytics

Overview is the leadership summary of the selected period.

### Volume and Trend Analysis

Shows Booked, Toured, No Show, Enrolled, and Churned volumes with previous-period comparisons and compact trends.

### Conversion and Cohort Analysis

Shows toured, no-show, conversion, close, and average-days measures using cohort rules.

### Performance Insights

Summarizes material operational signals and links to deeper analysis. The section supports combined drill-through where the insight represents an entire group of contributing records.

### Costs & Margin preview

Visible only to Admins and Super Admins. It summarizes available financial results without granting cost-record management rights.

## 14. Volume and Trend Analytics

This page explains when activity happened.

It includes:

- selected-period event volume;
- event share;
- trend and calendar/heatmap views;
- temporal rankings by quarter, month, week, or day;
- volume-performance rankings by location, lead source, and staff;
- current-period and All Time modes where offered.

Use event volume to answer “What happened during this period?” Use cohort analytics to answer “What eventually happened to the families originally booked in this period?”

## 15. Conversion and Cohort Analytics

This page explains progression for families scheduled in the selected period.

It includes:

- funnel/progression counts;
- toured, no-show, conversion, and close rates;
- average days to enroll;
- time-to-progress averages and day buckets;
- performance rankings;
- unresolved or off-track follow-up.

Cohort metrics may mature after the selected period. A family booked near period end may enroll later and still count in that cohort calculation.

## 16. Location, Lead Source, and Staff Analytics

These pages share a common analytical pattern:

- volume by entity;
- rates by entity;
- current-versus-previous comparison;
- compact trends;
- rankings;
- peak timing;
- positive and needs-attention insights;
- entity-specific drill-through.

### Location Analytics

Compares operating sites. Staff see only their assigned location.

### Lead Source Analytics

Compares inquiry origins and helps identify sources that produce volume, tours, enrollment, or no-show risk.

### Staff Analytics

Available only to Admins and Super Admins. It compares assigned-staff performance. It intentionally does not add a separate cross-entity lead-source-performance section.

Entity comparison is descriptive. Low-volume entities can show unstable percentages; interpret rate together with its eligible count.

## 17. Costs & Margin Analytics

Costs & Margin uses completed monthly financial periods and excludes an incomplete current month.

### Revenue

Sum of active Revenue cost-basis entries in the selected completed months.

### Costs

Sum of active Expenditure cost-basis entries in the selected completed months.

### Contribution margin

```text
Contribution Margin = Revenue − Costs
```

### Margin percentage

```text
Margin % = Contribution Margin ÷ Revenue × 100
```

If revenue is zero, Margin % is unavailable.

### Cost efficiency

```text
Cost per Booked Tour = Costs ÷ Booked volume
Cost per Completed Tour = Costs ÷ Toured volume
Cost per Enrollment = Costs ÷ Enrolled volume
```

The selected activity mode determines which denominator is emphasized. Lower cost per successful activity is generally favorable, but volume and service quality must be considered together.

### Location performance

Combines each location's revenue, costs, margin, margin percentage, activity volume, conversion, and efficiency. Financial location comparisons include only locations with applicable active financial data.

## 18. Analytics drill-through

Select a supported KPI, chart value, ranking, heatmap cell, or insight to open drill-through.

### What the drawer shows

1. KPI/card name.
2. Current value.
3. Previous value, difference, and difference percentage when applicable.
4. Context:
   - page;
   - section;
   - chart/card;
   - scope;
   - current and previous periods;
   - location, lead source, and staff filters.
5. Contributing data.

### Contributing-data columns

- Contributing KPI
- Contribution date
- Elapsed days, when relevant
- Days bucket, when relevant
- Family name
- Scheduled tour
- Location
- Current status
- Assigned staff
- Lead source
- Student name, when available
- Child grade
- Email / phone

The current data model has no dedicated student-name field. A blank student name therefore means the operational record did not provide one; family name remains the primary identity.

### Why drill-through count can differ from the displayed value

- A rate is a percentage; drill-through commonly lists the eligible denominator population.
- Average Days to Enroll lists the eligible scheduled-period tours that later enrolled.
- Event volume uses event dates; cohort metrics use scheduled-tour eligibility.
- A current status can differ from the earlier event that contributed to a KPI.
- Drill-through displays up to the first 100 records and identifies truncation.

### Export drill-through data

Select **Export these results**. The download contains the drill-through context and the complete filtered contributing dataset, not only the first visible rows. Its filename reflects page, section, chart/card, and KPI where available.

## 19. Analytics PDF export

The main analytics export is PDF-only.

### Export current page

1. Open an analytics page.
2. Apply page filters and view selections.
3. Select **Export**.
4. Choose **Current analytics page**.
5. Choose **Current view** or **All available views**.
6. Choose **Current filtered data** or **All authorized data**.
7. Start the export.
8. Keep the page open while RSS reports progress.
9. Wait for the completed notification and download.

### Export all analytics pages

Choose **All analytics pages**. RSS includes every analytics page the current role can access. Staff exports cannot include Staff or Costs & Margin pages.

### Current view versus all available views

| Selection | What the PDF includes |
|---|---|
| Current view | The metric and view selections currently displayed |
| All available views | Every supported alternative, such as each applicable status or metric mode |

### Current filtered data versus all authorized data

| Selection | What the PDF includes |
|---|---|
| Current filtered data | Active period, comparison, and entity filters |
| All authorized data | Entity selections are removed, but role and assigned-location permissions remain enforced |

### PDF layout rules

- Export uses a dedicated print layout, not a raw mobile screenshot.
- Mobile exports expand collapsed analytics sections.
- Section breaks are preserved where practical.
- Rankings and other scrollable lists are intentionally limited to the first five visible items in the PDF.
- Page names and export selections appear in the report.
- The filename reflects coverage, view scope, and data scope without embedding every page filter.

## 20. Settings and administration

### Manage locations — Admin and Super Admin

1. Open Settings.
2. Expand **Admin privileges**.
3. Select **Manage locations**.
4. Select **Add location** or Edit on an existing row.
5. Enter name, address, city, two-character state, ZIP code, and optional phone.
6. Set Active as appropriate.
7. Save.

Location names must be unique without regard to capitalization. Deactivation is preferred to deletion because existing tours and cost records retain protected references.

### Manage lead sources — Admin and Super Admin

1. Open **Manage lead sources**.
2. Add or edit the source name and description.
3. Set Active as appropriate.
4. Save.

Source names must be unique. Inactive sources remain attached to historical tours.

### Manage users — Super Admin

1. Open **Manage users**.
2. Select **Add user**.
3. Enter first name, last name, email, role, and initial password.
4. If the role is Staff, assign a location.
5. Save.

Rules:

- Staff must have a location.
- Admin and Super Admin accounts cannot have a Staff location assignment.
- Email addresses are case-insensitively unique.
- A Super Admin cannot remove their own Super Admin role.
- Deactivation is preferred to destructive deletion.

### Manage cost/revenue — Super Admin

1. Open **Manage cost/revenue**.
2. Select **Add cost/revenue**.
3. Select location.
4. Select reporting month.
5. Choose Revenue or Expenditure.
6. Enter a non-negative amount.
7. Add notes if needed.
8. Save.

Only one record may exist per location, month, and cost type. Edit the existing record instead of creating a duplicate.

## 21. Data rules and assumptions

- Analytics reads live operational tables; there is no separate analytics warehouse.
- Tour-event history is the source for event timing.
- Cohort eligibility is based on scheduled-tour date.
- Event-volume eligibility is based on the relevant contribution event date.
- Current status is descriptive and does not erase earlier qualifying events.
- Financial reporting uses active cost-basis records.
- The incomplete current month is excluded from financial analytics.
- “All” always means all values within the user's authorization.
- Test-only records may be excluded by analytics rules.
- Percentages without a denominator are unavailable.
- Comparisons require a valid previous period.
- Rankings should be interpreted with volume, not rate alone.
- Executive summaries are deterministic rules, not artificial intelligence.
- RSS Assistant is a navigation/help assistant, not an autonomous decision maker.
- Analytics Engine administration and its former operational-history model have been removed from the current product.

## 22. Troubleshooting

### I cannot see a page

Check the role matrix. Staff cannot access Staff Analytics, Costs & Margin, or administration. Admins cannot manage users or cost/revenue.

### I cannot see another location

Staff are locked to their assigned location. Contact a Super Admin if the assignment is incorrect.

### An analytics value and row count differ

Open drill-through and read **Why this count differs**. Confirm whether the KPI is an event count, cohort rate, average, or final current status.

### The percentage is blank

The denominator may be zero, the comparison may be unavailable, or the record may not yet have matured.

### A filter shows a long list after Select all

This should display as “All.” Refresh and report the affected page if individual values remain listed.

### Export appears inactive

Keep the page open. RSS shows preparing/progress/completed status. Large all-page/all-view exports require more time.

### Mobile content is collapsed in an export

The current export contract expands analytics sections. If content remains missing, report the page, role, viewport, export options, and downloaded filename.

### A status move fails

The requested transition may not be permitted, the record may have changed, or the user may not have access to its location. Refresh before retrying.

## 23. Training exercises

### Exercise 1: Find and review a tour

1. Sign in with the training account.
2. Open Tours.
3. Search for the trainer-provided family.
4. Open the record.
5. Identify the scheduled time, location, assigned staff, lead source, current status, and latest history event.
6. Return to Tours without changing the record.

**Successful completion:** The learner can distinguish current status from event history.

### Exercise 2: Create and update a training tour

1. Open Add Tour.
2. Enter the trainer-provided family and contact information.
3. Select the correct location, lead source, and staff member.
4. Choose the scheduled date and time.
5. Save.
6. Reopen the record.
7. Update the outcome using the trainer-provided scenario.
8. Confirm the new status and history event.

**Successful completion:** The learner can create a complete record and understands that a status update adds workflow history.

### Exercise 3: Use Pipeline

1. Open Pipeline.
2. Find the training tour.
3. Switch between Card and Board view.
4. Use the valid move control to progress the tour.
5. Confirm the resulting status.

**Successful completion:** The learner uses only an allowed transition and does not confuse filtering with changing status.

### Exercise 4: Interpret analytics

1. Open Analytics Overview.
2. Select the trainer-provided period.
3. Identify Booked, Toured, No Show, and Enrolled.
4. Explain the difference between event volume and a cohort rate.
5. Open a KPI drill-through.
6. Identify the KPI, period, filters, contribution date, and current status.

**Successful completion:** The learner can explain why the displayed KPI and contributing row count may differ.

### Exercise 5: Export a report

1. Open an authorized analytics page.
2. Apply a visible filter.
3. Export Current analytics page, Current view, and Current filtered data.
4. Wait for the completed notification.
5. Open the PDF and confirm the page name and selections.

**Successful completion:** The learner understands that an export preserves authorization and that All authorized data is still role-limited.

### Exercise 6: Administration

Complete only with the appropriate training role:

- Admin: create or update a training location and lead source.
- Super Admin: create a Staff training user with a location.
- Super Admin: add a training monthly cost/revenue record.

**Successful completion:** The learner can explain which actions are restricted to Super Admin.

## 24. Trainer knowledge checks

Use these questions at the end of onboarding:

1. What does Booked mean in RSS?
2. What is the difference between current status and contribution date?
3. Why can an Enrolled event count differ from a cohort conversion rate?
4. Which role can manage users?
5. Which role can manage cost/revenue?
6. Can Staff select another location?
7. Does All authorized data bypass permissions?
8. What should a user do before changing a tour outcome?
9. Why might a percentage be unavailable?
10. What information should be included in a support request?

Recommended passing standard: the learner correctly answers questions 2, 3, 4, 6, and 7, plus at least three others.

## 25. Support information to collect

When reporting an issue, include:

- environment: local, Staging, or Production;
- role;
- assigned location, if Staff;
- page and section;
- viewport size and portrait/landscape orientation;
- active filters;
- exact steps;
- expected result;
- actual result;
- screenshot;
- exported filename, when applicable;
- approximate time of occurrence.

Do not include passwords, reset tokens, authentication tokens, database credentials, or secret environment variables.

## Appendix A. Quick role-based starting points

### Staff daily workflow

1. Sign in.
2. Review Home and Action Needed.
3. Open today's booked tours.
4. Update completed outcomes.
5. Review no-shows.
6. Use Pipeline for remaining follow-up.
7. Use Overview or Volume Analytics for assigned-location context.

### Admin daily/weekly workflow

1. Review organization-wide Home and Pipeline.
2. Check missing outcomes.
3. Compare locations and lead sources.
4. Review Staff Analytics.
5. Review Costs & Margin without changing cost records.
6. Maintain locations and lead sources.

### Super Admin operational workflow

1. Perform the Admin workflow.
2. Maintain users and assignments.
3. Maintain monthly revenue and expenditure records.
4. Review financial completeness before leadership reporting.
5. Export authorized analytics reports.

## Appendix B. Formula reference

| Metric | Formula |
|---|---|
| Difference | Current − Previous |
| Difference % | `(Current − Previous) ÷ Previous × 100` |
| Toured Rate | Toured ÷ Booked × 100 |
| No-show Rate | No Show ÷ Booked × 100 |
| Conversion Rate | Enrolled ÷ Toured × 100 |
| Close Rate | `(Enrolled + Churned) ÷ Toured × 100` |
| Average Days to Enroll | Average of `Enrollment date − Scheduled date` |
| Contribution Margin | Revenue − Costs |
| Margin % | Contribution Margin ÷ Revenue × 100 |
| Cost per Booked Tour | Costs ÷ Booked volume |
| Cost per Completed Tour | Costs ÷ Toured volume |
| Cost per Enrollment | Costs ÷ Enrolled volume |

## Appendix C. Record protection

Locations, lead sources, users, and families may be referenced by historical tours. Cost records and workflow events are also part of reporting history. Use active/inactive controls and approved corrections instead of deleting referenced records.
