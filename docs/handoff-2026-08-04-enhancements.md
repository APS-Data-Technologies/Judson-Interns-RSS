# Ready Set STEM Enhancement and Release Handoff

**Handoff date:** August 4, 2026
**Repository:** `/Users/jagadeshkumarparanthaman/Projects/Judson-Interns-RSS`
**Current phase:** Continued enhancements, development/staging validation, and production-readiness follow-up
**Current local branch:** `feature/next-enhancements-continuation`
**Current HEAD:** `5986f78a3fb0265e125989f0b92105d740fa09be`
**Current `develop` and `origin/develop`:** `5986f78`

## 1. Mandatory Start Procedure

Before taking any action in a continuation task:

1. Use `/Users/jagadeshkumarparanthaman/Projects/Judson-Interns-RSS`.
2. Do not use `/Users/jagadeshkumarparanthaman/Documents/RSS`.
3. Read this document completely.
4. Inspect Git without changing it:

   ```bash
   git branch --show-current
   git rev-parse HEAD
   git status --short
   ```

5. Preserve every intentional untracked artifact listed below.
6. Preserve `database/backups/` under all circumstances.
7. Do not clean, reset, delete, overwrite, stage, or commit unrelated user work.
8. Never expose passwords, database URLs, Railway tokens, API tokens, authentication tokens, or private data.
9. The existing staging Super Admin password must never be requested, printed, copied, documented, or stored.
10. Do not change code, Git, deployments, databases, accounts, or documentation until the user requests the next action.

## 2. Current Git State

At creation of this handoff:

- Branch: `feature/next-enhancements-continuation`
- HEAD: `5986f78a3fb0265e125989f0b92105d740fa09be`
- Local `develop`: `5986f78`
- `origin/develop`: `5986f78`
- Latest merged PR: `#50`, “Fix New Tour submissions and mobile analytics PDF layout”
- Previous merged PR: `#49`, “Enhance tour workflows, responsive UX, and analytics exports”
- Earlier enhancement PR: `#48`, “Enhance tour intake, pending actions, and RSS Assistant”

Recent implementation commits:

- `55c6957` — Fix tour creation and mobile analytics exports
- `5833f91` — Enhance tour workflows and analytics exports
- `65e7dcc` — Enhance tour intake, pending actions, and RSS Assistant

Current intentional untracked paths:

```text
database/backups/
docs/RSS-application-handbook.md
docs/handoff-2026-07-22-analytics-follow-up.md
docs/handoff-2026-07-23-week-5.md
docs/handoff-2026-07-30-week-6.md
docs/week-4-report.md
docs/week-6-task-inventory.md
output/
tmp/
```

This handoff is also intentionally untracked until the user explicitly requests a commit.

## 3. Application Purpose and Architecture

Ready Set STEM is an internal tour-to-enrollment management application.

Primary capabilities:

- Authentication and role-aware authorization
- Home dashboard and overdue operational follow-up
- Family and tour creation, viewing, editing, rescheduling, cancellation, and status updates
- Five-stage pipeline tracking
- Analytics, drill-through, rankings, comparisons, and PDF export
- Location, lead source, user, and cost-basis administration
- PostgreSQL-backed local, development, staging, and future production environments

Technology:

- Frontend: React and Vite
- Backend: Django REST Framework
- Database: PostgreSQL
- Hosting: Railway
- Repository: `https://github.com/APS-Data-Technologies/Judson-Interns-RSS`

Environment model:

```text
One shared codebase
├── Local frontend + local backend + local PostgreSQL
├── Railway development frontend + backend + PostgreSQL
├── Railway staging frontend + backend + PostgreSQL
└── Future production frontend + backend + separate PostgreSQL
```

Each Railway environment has separate services, environment variables, domains, deployment history, and persistent database state even though development and staging deploy the same `develop` code.

## 4. Roles and Authorization

### Staff

- Location-scoped operational access
- Can use Home, Tours, Pipeline, permitted analytics, search, assistant, and account features
- Cannot manage users
- Cannot manage cost basis
- Cannot access cross-location Staff or Costs & Margin analytics
- Cannot create or update tours for another location

### Admin

- Cross-location operational access
- Can manage locations and lead sources
- Can access Staff and Costs & Margin analytics
- Cannot manage users
- Cannot manage cost basis

### Super Admin

- Full cross-location access
- Can manage users, roles, account status, and password resets
- Can manage locations, lead sources, and cost basis
- Can access all analytics, drill-through, and exports

Frontend visibility is not a security boundary. Backend querysets, serializers, permissions, and operations must enforce the same rules.

## 5. Responsive Contract

The product intentionally has two modes:

1. **Mobile/portrait:** phones and portrait tablets
2. **Landscape/laptop:** landscape tablets, laptops, and desktops

Within each mode, the interface first attempts to fit. Below its usable threshold, content scrolls instead of becoming a broken hybrid layout.

Important responsive requirements:

- Fixed navigation, banners, filters, headings, cards, and pipeline controls must not overlap content.
- Information messages remain visible on mobile and must not be hidden behind fixed elements.
- Only one information message should be open at a time.
- Mobile action controls maintain practical touch targets.
- Laptop layouts may be denser but must remain readable.
- RSS Assistant is in the left sidebar above Logout for laptop/landscape.
- RSS Assistant remains fixed at the bottom-right for mobile/portrait.

## 6. Family and Student Data Rules

### Family names

- Store and display exactly what the user enters.
- Do not automatically add `Family` as a prefix or suffix.
- Do not append `Family` in the database, API, UI, filters, cards, or exports.
- Existing historical values that already contain `Family` remain unchanged unless separately cleaned.

### Duplicate family names

When a matching accessible family name already exists:

- Do not silently reuse it.
- Return the accessible family matches.
- Ask the user to choose an existing family or explicitly create a separate family record.
- Reusing a family preserves its existing contact information.
- Creating a new family creates a separate record with the submitted contact information.

### Student name

- Student name is now a real optional `student_name` column on the `tours` table.
- It is not stored only in family notes.
- New Tour and Edit Tour accept it.
- Tour details and analytics may display it.
- It remains optional.
- Migration `tours.0003_tour_student_name` introduced the column.

## 7. New Tour Form and Validation

Collected fields:

- Family name — required
- Student name — optional
- Phone — required in the UI
- Email — required in the UI
- Location — required
- Lead source — required
- Grade — required
- Date — required
- Time — required
- Notes — optional

Phone contract:

- UI accepts digits only.
- UI limits input to 10 digits.
- Mobile uses the numeric keyboard.
- Frontend requires exactly 10 digits before save.
- Backend create and update serializers enforce exactly 10 digits when a phone value is supplied.
- Formatted numbers such as `312-555-0199`, short numbers, and numbers longer than 10 digits are rejected.

Grades use the approved Ready Set STEM list from `frontend/src/features/tours/gradeOptions.js`. Do not add a “Not sure” option unless separately requested.

### Confirm Save defect and fix

PR #50 fixed a device-independent New Tour failure:

- The Confirm Save button previously used `onClick={saveTour}`.
- React passed its click event as the function argument.
- The event was spread into the request payload.
- Axios failed while serializing the event before the request reached Django.
- Users saw only “Unable to save tour.” on both laptop and mobile.

The corrected behavior:

- Confirm Save calls `saveTour()` explicitly.
- The request payload only accepts `existing_family` and `create_new_family` as family-resolution additions.
- Arbitrary objects or event properties cannot be spread into the API payload.

### Unsaved changes

- Leaving a dirty New Tour form uses a true centered modal overlay.
- The user can Stay or Leave Page.
- The warning is not an inline banner at the top of a long form.

## 8. Five-Stage Status and Operational Badges

The database and pipeline use five reporting statuses:

1. `scheduled` — Booked
2. `toured` — Toured
3. `no_show` — No Show
4. `enrolled` — Enrolled
5. `churned` — Churned

Operational events/badges:

- `rescheduled`
- `cancelled`

Rules:

- A rescheduled tour remains `scheduled` in the database and Booked in the pipeline/analytics.
- It displays a Rescheduled operational badge based on its event history.
- A cancelled tour moves to `no_show` in the database and No Show in the pipeline/analytics.
- It displays a Cancelled operational badge.
- Cancelled is not a sixth pipeline column.
- Rescheduled is not a sixth pipeline column.
- Booked analytics include rescheduled tours.
- No Show analytics include cancelled tours.
- Cancelled tours cannot be edited.

Migration:

- `backend/apps/tours/migrations/0004_five_stage_tour_statuses.py`
- Normalizes status choices and historical status values.
- Adds cancellation fields and operational event choices.

Allowed primary transitions:

```text
Scheduled -> Toured
Scheduled -> No Show
Toured -> Enrolled
Toured -> Churned
```

Reschedule and Cancel use dedicated endpoints and workflows.

## 9. Cancellation and Rescheduling UI

### Reschedule

- Available for eligible scheduled tours.
- Updates the scheduled date/time through the dedicated reschedule endpoint.
- Creates a Rescheduled event.
- Keeps the tour in Booked/Scheduled.

### Cancel tour

- Available inside Edit Tour for eligible scheduled tours.
- Destructive action label: `Cancel Tour`.
- Neutral page-leaving action label: `Exit` rather than another ambiguous `Cancel`.
- Confirmation uses a document-level React portal.
- The modal stays centered above the page rather than inside a scrolled card.
- Optional cancellation reason is supported.
- Confirmation explains that the tour moves to No Show and receives a Cancelled badge.
- Cancellation cannot be undone through the normal UI.

## 10. Tours and Pipeline UI

Desktop/laptop refinements:

- Reduced tour card height and typography.
- Reduced filter height and spacing.
- Reduced status badge height.
- Reduced View/Edit icon button size.
- Reduced Details/Edit button size.
- Compacted detail rows while preserving hierarchy.
- Fixed overdue badges that were clipped at the top of the first card.

Mobile behavior retains readable spacing and practical touch targets.

Pending Actions copy:

- Heading: `Pending Actions`
- Scheduled copy: `[count] scheduled tours past their tour date`
- Action: `Set Toured / No Show`
- Completed copy: `[count] completed tours past the average enrollment window`
- Action: `Set Enrolled / Churned`

Navigation rules:

- Set Toured / No Show opens the Booked pipeline view.
- Set Enrolled / Churned opens the Toured pipeline view.

## 11. Tour Date Filters

Available date choices:

- All Time
- MTD
- YTD
- Today
- Yesterday
- Last 30 days, including today
- Last N days
- Next N days
- Custom From and To

Behavior:

- MTD means the first day of the current month through today.
- YTD means January 1 through today.
- Simple presets close the menu after selection.
- MTD and YTD expose their exact selected range through accessible title/tooltip text.
- Custom dates are drafts until Apply is selected.
- Custom ranges require both From and To.
- To cannot be earlier than From.
- Rolling-day values are constrained to 1–3650.
- Narrow-phone layouts wrap labels rather than making the controls unreadable.

## 12. RSS Assistant

Current behavior:

- Simplified branding and greeting.
- Unified search and conversation entry.
- Permission-aware shortcuts.
- Suggestions for the current page appear first.
- Suggestions for all other authorized pages follow.
- Shortcut selections navigate directly to the intended workspace.
- Suggested questions are framed as reusable prompt-style questions.

Do not add persisted user-saved shortcuts without a separately approved data model and persistence design.

## 13. Analytics Rules

Business rules that must remain stable:

- Event-date activity and cohort-state analysis are different concepts.
- Toured, no-show, enrolled, and churned counts may be based on contribution events that differ from current status.
- Financial reporting uses completed months.
- Cost basis is location- and month-aware.
- Staff remains assigned-location scoped.
- Percentages with zero denominators do not invent values.
- Current and previous comparisons use equivalent durations and business logic.
- All-time ranking context must remain visible.
- Headline values, drill-through records, and exported records must reconcile according to their documented KPI logic.

## 14. Analytics Drill-Through

Drill-through is standardized across:

- Overview
- Volume & Trend
- Conversion & Cohort
- Location
- Lead Source
- Staff
- Costs & Margin

Context includes, where applicable:

- Page
- Section
- Chart/card
- KPI
- Current period
- Previous period
- All-time selection
- Location
- Lead source
- Staff
- Metric-specific bucket or selection

Comparison blocks show:

- Current value
- Previous value
- Difference
- Difference percentage

Contributing records use this sequence:

1. Contributing KPI
2. Contribution date
3. Family name
4. Scheduled tour
5. Location
6. Current status
7. Assigned staff
8. Lead source
9. Student name
10. Grade
11. Email/phone

The action column was intentionally removed.

When a headline and contributing-record count differ due to event/cohort logic, the drill-through must explain the distinction.

Drill-through exports include context and data together, remain role/filter aware, and use descriptive filenames.

## 15. Analytics PDF Export

The analytics report export is PDF-only.

Export choices:

- Current page or all authorized pages
- Current view or all available views
- Current filtered data or all authorized data

Core behavior:

- Uses browser-rendered designed analytics content.
- Preserves page identity, charts, cards, filters, and visual styling.
- All-view exports include every applicable status/view.
- Mobile expansion for export does not alter the visible mobile screen state.
- Ranking exports show five rows rather than every scrollable record.
- Export work is performed in a hidden iframe and does not require the user to remain on the same visible analytics page after preparation begins.

### Cover design

- White background
- Official horizontal Ready Set STEM logo
- Company heading: `READY SET STEM`
- Report title: `Tour-to-Enrollment Analytics Report`
- Navy and official gold headings
- No `CONFIDENTIAL - EXECUTIVE ANALYTICS` label
- No “Decision-ready analytics” promotional panel
- Report details show coverage, views, data scope, and report-view count
- Bottom metadata includes generated person based on the signed-in account, role, date, time, and timezone

### Pagination strategy

The paginator:

- Captures a complete analytics page to one canvas.
- Computes sorted, deduplicated, strictly increasing boundaries.
- Rejects backward or duplicate content slices.
- Moves headings and their initial visuals together when they fit on a fresh page.
- Treats important section groups as atomic when they fit.
- Allows safe internal splitting when a section is taller than a page.
- Uses repeating headers for long applicable tables.
- Adds a small capture bleed before key headings to prevent thin slivers.

Atomic groups currently include:

- Period heading plus first analytics visual
- Complete temporal ranking section when it fits
- Volume performance ranking heading and cards
- Cohort performance banner and grid
- Location performance heading and first card row
- Initial report heading and summary

### Mobile PDF defect and fix

PR #50 addressed mobile Safari exports that differed from laptop output.

Observed defects:

- Temporal ranking cards were exported in one column rather than five columns.
- Day-of-Month SVG labels overflowed into ranking rows.
- Headings and cards became orphaned across pages.
- Mobile-only information icons appeared in the PDF.

Cause:

- Mobile Safari retained coarse-pointer/mobile media-query behavior inside the off-screen iframe even when its CSS width was 1440px.

Fix:

- Export iframe, document element, body, and viewport are explicitly locked to 1440px.
- Export-only CSS reasserts the desktop five-column temporal ranking layout.
- Export-only CSS reasserts the desktop three-column performance ranking layout.
- Mobile-only information controls are hidden in export.
- Temporal SVG overflow is clipped.
- Pagination treats period/first-visual and temporal sections atomically when they fit.

Relevant files:

- `frontend/src/features/analytics/analyticsApi.js`
- `frontend/src/features/analytics/analyticsPagination.js`
- `frontend/src/pages/Analytics/Analytics.css`
- `frontend/src/pages/Analytics/AnalyticsActions.jsx`

## 16. Analytics Engine Removal

The hidden Analytics Engine administration feature was intentionally removed:

- Frontend route/page/API
- Backend operations module
- Backend model/APIs
- Engine-specific tests and documentation
- Database model through migration

Do not recreate or expose Analytics Engine unless the user explicitly requests a new approved design.

## 17. Generated Documentation and Reports

User handbook source:

- `docs/RSS-application-handbook.md`

Generated handbook:

- `output/pdf/RSS-User-Training-Handbook.pdf`

Week 6 reports:

- `output/docx/RSS_Week_6_Status_Report_Editable.docx`
- `output/pdf/RSS_Week_6_Status_Report.pdf`
- Google Doc: `https://docs.google.com/document/d/12kTw5HuZqozWkVm0z535Rgsd1_4uTcbDXgjnN04Beo8/edit`

Authoritative Week 6 inventory:

- `docs/week-6-task-inventory.md`

Stored Week 6 counts remain:

- 9 total workstreams
- 8 completed
- 1 in progress
- 39 total subtasks
- 36 completed
- 3 in progress
- 92% completion by stored subtask

Do not invent replacement counts without revising the authoritative inventory with evidence.

## 18. Railway Environments

Railway project:

`https://railway.com/project/090f1fee-e9b8-4efa-95e2-33999741e3fe`

### Development

- Environment ID: `204050c3-2ad8-4181-a426-c48af5ac2349`
- Frontend: `https://frontend-development-745a.up.railway.app`
- Backend: `https://backend-development-530c.up.railway.app`
- PostgreSQL: separate Railway PostgreSQL service and persistent volume

### Staging

- Environment ID: `1a56ff7b-3693-4475-87f1-2ecc5f2a7ffd`
- Frontend: `https://frontend-staging-e3c8.up.railway.app`
- Backend: `https://backend-staging-bb3f.up.railway.app`
- PostgreSQL: separate Railway PostgreSQL service and persistent volume

Both environments currently deploy `develop` automatically.

Latest verified deployment:

- PR `#50`
- Merge commit `5986f78`
- Development frontend: active and successful
- Development backend: active and successful
- Development PostgreSQL: online
- Staging frontend: active and successful
- Staging backend: active and successful
- Staging PostgreSQL: online
- Backend root and `/api/`: HTTP 200 in both environments
- Frontend root and `/tours`: HTTP 200 in both environments

The backend Docker command runs migrations before Gunicorn:

```text
python manage.py migrate && gunicorn config.wsgi:application ...
```

### Staging Super Admin

Exactly one existing staging Super Admin is documented:

- Email: `kr@gmail.com`
- Name: `K R`
- Role: `super_admin`
- Active: yes

The password is intentionally absent. Never request, expose, copy, store, or commit it.

Do not create additional staging users without explicit user approval.

## 19. Production Status

Production setup is not complete.

Required production contract:

- Separate Railway environment
- Separate frontend, backend, and PostgreSQL services
- Separate persistent volume and data
- Schema through Django migrations
- No automatic copy of local or staging data
- Production-only secrets and domains
- Frontend API URL pointing only to production backend
- Backend allowed hosts, CORS, and CSRF restricted to approved production origins
- Securely created initial Super Admin
- Go-live only after staging acceptance and sponsor approval

Do not deploy or configure production without an explicit request.

## 20. Database and Seed Rules

- Django migrations own schema creation.
- `database/seeds/rss_seed_data.sql` is demonstration data only.
- Imported seed users have intentionally unusable passwords.
- Seed data is not production data.
- Do not load seeds into development, staging, or production without explicit approval.
- Preserve `database/backups/`.
- Never commit database credentials, private exports, or raw production backups.
- Do not modify deployed data merely to test a UI change unless the user authorizes it.

## 21. Validation Commands

Frontend:

```bash
cd /Users/jagadeshkumarparanthaman/Projects/Judson-Interns-RSS/frontend
npm run lint
npm run build
```

Backend full targeted suite:

```bash
cd /Users/jagadeshkumarparanthaman/Projects/Judson-Interns-RSS
DATABASE_URL='sqlite:///:memory:' backend/venv/bin/python backend/manage.py test \
  apps.accounts.tests.test_authentication \
  apps.analytics.tests.test_drill_through \
  apps.analytics.tests.test_financial_summary \
  apps.leads.tests.test_lead_source_api \
  apps.reports.tests.test_cost_basis_api \
  apps.sites.tests.test_location_api \
  apps.tours.tests.test_home_summary \
  apps.tours.tests.test_tour_workflow
```

Current expected targeted count after PR #50: 123 tests.

Migrations:

```bash
backend/venv/bin/python backend/manage.py makemigrations --check --dry-run
backend/venv/bin/python backend/manage.py migrate --check
```

Repository:

```bash
git diff --check
git status --short
git diff --stat
```

The Vite warning for a JavaScript chunk larger than 500 kB is informational and does not fail the build.

## 22. Complete `kr commit` Workflow

When the user says `kr commit`, complete all steps:

1. Inspect branch, HEAD, status, and diff.
2. Preserve unrelated work and every intentional untracked artifact.
3. Identify only the files belonging to the requested change.
4. Run proportionate frontend, backend, migration, and repository validation.
5. Stage only intended files using explicit paths; never use `git add .`.
6. Review staged status and diff/stat.
7. Commit locally with a descriptive message.
8. Fetch the latest GitHub state.
9. Merge `origin/develop` into the feature branch.
10. Resolve conflicts carefully without discarding user work.
11. Re-run validation after the merge even if Git reports “Already up to date.”
12. Push the feature branch.
13. Create a pull request targeting `develop` with a professional title and a
    detailed description covering implementation, validation,
    migrations/database impact, and deployment checks.
14. Wait for the required frontend and backend checks.
15. Merge only after both checks succeed, then record the PR URL and merge commit.
16. Complete the Railway deployment monitoring workflow in Section 23.

Never push directly to `develop` unless the user explicitly requests it.

PR creation, required checks, merge, and post-merge Railway monitoring are mandatory
parts of `kr commit`; they are not optional follow-up steps.

After a merge to `develop`, Railway monitoring records the merge commit, waits for
development frontend/backend success and PostgreSQL online status, repeats for
staging, verifies all eight public routes, and confirms protected unauthenticated
endpoints still return HTTP 401. It must not seed data, create accounts, expose
credentials, or touch production. Follow the complete monitoring procedure below.

## 23. Railway Deployment Monitoring Workflow

After merging to `develop`:

1. Fetch `origin/develop` and record the merge commit.
2. Open Railway development.
3. Wait until frontend and backend finish Building/Deploying.
4. Confirm both services are Active and Deployment successful for the new PR/merge.
5. Confirm PostgreSQL is Online.
6. Repeat for staging.
7. Verify public routes:

   ```text
   development backend /
   development backend /api/
   development frontend /
   development frontend /tours
   staging backend /
   staging backend /api/
   staging frontend /
   staging frontend /tours
   ```

8. Expected unauthenticated protected-endpoint behavior remains HTTP 401.
9. Do not seed data, create accounts, expose credentials, or touch production during deployment validation.

## 24. Complete `kr cleanup` Workflow

When the user says `kr cleanup`:

1. Inspect uncommitted work.
2. Preserve user work and intentional untracked artifacts.
3. Fetch `origin`.
4. Switch to local `develop`.
5. Fast-forward only:

   ```bash
   git pull --ff-only origin develop
   ```

6. Create a clean `feature/...` branch from the latest merged `develop`.
7. Do not invent a different branch name if the user supplied one.
8. Confirm the new branch, HEAD, and status.
9. Do not delete backups, reports, handoffs, generated output, or temporary user artifacts.

The current cleanup result is:

- Branch: `feature/next-enhancements-continuation`
- HEAD: `5986f78`
- Only intentional untracked artifacts are present.

## 25. Complete `ai cleanup` Workflow

When the user says `ai cleanup`, remove unnecessary references or attribution to
AI assistants and AI development tools from the entire current project safely.
The workflow definition in this section is the only intentional exception because
it is required to preserve the command itself.

1. Inspect the current branch, HEAD, status, tracked changes, intentional untracked
   artifacts, and relevant ignored project-owned files before changing anything.
2. Preserve unrelated user work, `database/backups/`, reports, handoffs, generated
   output, temporary user artifacts, credentials, private data, and legally required
   notices or provenance.
3. Build a case-insensitive inventory across tracked and untracked project-owned
   content, including:
   - file and folder names;
   - source identifiers, variable names, component and element names, selectors,
     labels, comments, string literals, quotations, prompts, and user-facing copy;
   - documentation, reports, handoffs, templates, configuration, and scripts;
   - generated PDF, DOCX, presentation, spreadsheet, and other artifact text and
     document properties such as author, creator, producer, comments, and keywords;
   - image, video, and audio metadata, including EXIF, XMP, PNG ancillary chunks,
     content credentials, certificate strings, prompts, author, creator, and software;
   - local and remote branch and tag names, Git commit messages, trailers, authors,
     committers, PR references, and release metadata.
4. Exclude third-party dependencies, virtual environments, Git object storage,
   database backups, and private exports from mechanical rewriting. Report any
   relevant matches there without modifying them.
5. Classify every match before removal:
   - remove unused files only after confirming there are no imports, URLs, runtime
     references, generated-bundle references, or duplicate consumers;
   - rename used files, folders, identifiers, selectors, and UI elements to neutral,
     accurate names and update every consumer atomically;
   - rewrite documentation, comments, quotations, and product copy without changing
     their operational or legal meaning;
   - replace AI-negation language with accurate neutral wording such as
     `deterministic and rule-based` when that is the actual behavior;
   - regenerate derived artifacts from their authoritative sources rather than
     patching only the visible output;
   - strip incidental metadata by lossless or visually equivalent re-encoding, while
     preserving dimensions, transparency, color behavior, and required provenance.
6. For media cleanup, compare dimensions and rendered output before and after,
   inspect metadata and embedded strings again, and visually verify every changed
   asset. Do not remove content credentials or attribution when retention is required
   by law, license, policy, or an explicit user requirement; report that limitation.
7. Handle Git references conservatively:
   - rename the active local branch to a neutral user-approved name when necessary;
   - delete an obsolete local branch only after Git confirms it is fully merged;
   - do not delete or rename remote branches or tags without explicit approval;
   - do not rewrite shared commit history, commit messages, Git authors, committers,
     signed commits, merge commits, or PR history as part of normal cleanup;
   - if historical metadata is the only remaining match, report it and explain that
     removal requires a separately approved coordinated history rewrite and force-push.
8. Never falsify authorship, conceal legally material provenance, remove licenses,
   or replace an accurate author with an inaccurate person. Neutral organization
   metadata may replace incidental tool metadata only when it remains truthful.
9. Re-run repository-wide textual, filename, branch/tag, binary-string, media-metadata,
   and generated-artifact searches. The command definition in this section may be
   excluded from the final reference count; no other unexplained match may remain.
10. Run proportionate lint, build, tests, migration checks, document rendering,
    media inspection, and `git diff --check`. Review the complete final status and
    diff without staging unrelated files.
11. Report exactly what was removed, renamed, regenerated, preserved, or left only
    in immutable/shared history. Do not stage, commit, push, delete remote references,
    deploy, or rewrite history unless the user separately requests those actions.

## 26. Known Remaining Validation and Follow-Up

- Perform authenticated staging acceptance of New Tour creation after PR #50 using the existing account; do not request its password.
- Re-export a Volume & Trend PDF from a physical mobile device and visually confirm it matches the laptop composition.
- Continue testing analytics PDF exports for all pages, views, filter states, and unusually tall ranking data.
- Complete role/device staging acceptance documentation.
- Decide whether staging remains schema-only or receives separately approved demonstration data.
- Complete separate production setup only after approval.
- Record sponsor acceptance, remaining risks, support ownership, and rollback procedures.

## 27. Continuation Instruction

The next task must:

1. Read this document completely.
2. Summarize its understanding of the repository, Git state, preservation rules, architecture, roles, responsive contract, family/student rules, New Tour validation, five-stage workflow, analytics and PDF behavior, Railway environments, staging account restrictions, production status, database rules, validation commands, and complete `kr commit`/deployment/`kr cleanup`/`ai cleanup` workflows.
3. Make no code, Git, database, deployment, account, or documentation changes until the user gives a subsequent request.
