# Judson-Interns-RSS

Repository for the Judson Internship Project - Summer 2026.

This project is a Ready Set STEM internal application for managing leads, tours, pipeline activity, analytics, reporting, and administration. The system is planned as a full-stack web application with a React frontend, Django backend, and PostgreSQL database.

## Project Goals

- Capture and organize lead intake information.
- Log tours and related follow-up activity.
- Track prospects through a pipeline board.
- Measure close rates and related analytics.
- Report margin and site-level performance.
- Provide role-aware administration and access control.

## Technical Scope

- **Frontend:** React application for user-facing screens and dashboards.
- **Backend:** Django API for business logic, authentication, and data access.
- **Database:** PostgreSQL for application data.
- **Security:** Role-aware access control for users and administrative features.

## In-Scope Features

### Lead Intake and Tour Logging

Stores lead information, captures inquiry details, and records tour activity. This area supports the early workflow from first contact through follow-up.

### Pipeline Board

Tracks leads or prospects through defined pipeline stages. This helps the team understand status, ownership, next actions, and conversion progress.

### Close-Rate Analytics

Provides analytics around lead conversion and close rates. This area is intended to help the team understand performance over time and across cohorts.

### Margin and Site Reporting

Supports reporting for margin and site-level operations. This area is intended for business visibility across locations or program sites.

### Administration

Provides administrative tools for users, roles, configuration, and system management.

## Repository Structure

```text
Judson-Interns-RSS/
├── README.md
├── .gitignore
├── .env.example
├── backend/
│   ├── README.md
│   ├── config/
│   └── apps/
│       ├── accounts/
│       ├── analytics/
│       ├── leads/
│       ├── pipeline/
│       ├── reports/
│       ├── sites/
│       └── tours/
├── frontend/
│   ├── README.md
│   └── src/
│       ├── app/
│       ├── components/
│       ├── lib/
│       └── features/
│           ├── admin/
│           ├── analytics/
│           ├── leads/
│           ├── pipeline/
│           ├── reports/
│           └── tours/
├── database/
│   ├── README.md
│   ├── init/
│   ├── schema/
│   └── seeds/
├── docs/
│   └── project-scope-summary.md
└── scripts/
    └── README.md
```

## Repository Explanation

### Root Files

- `README.md` - Main project overview, scope, repository structure, and setup notes.
- `.gitignore` - Excludes local environment files, generated caches, build output, logs, virtual environments, and IDE files from Git.
- `.env.example` - Template for local environment variables. Developers should copy this to `.env` and fill in local values.

### `backend/`

Backend/API code belongs here. The planned backend framework is Django.

- `backend/config/` - Django project configuration, such as settings, URL routing, ASGI, and WSGI files.
- `backend/apps/` - Django application modules grouped by business domain.
- `backend/apps/accounts/` - Authentication, users, roles, and permissions.
- `backend/apps/leads/` - Lead intake data and lead-related API behavior.
- `backend/apps/tours/` - Tour logging and tour-related workflows.
- `backend/apps/pipeline/` - Pipeline stages, status tracking, and movement through the sales or enrollment process.
- `backend/apps/analytics/` - Close-rate calculations, metrics, and analytical API endpoints.
- `backend/apps/reports/` - Reporting logic and report-oriented endpoints.
- `backend/apps/sites/` - Site or location-specific data.

### `frontend/`

Frontend/UI code belongs here. The planned frontend framework is React.

- `frontend/src/app/` - Application shell, routing, layouts, and top-level app setup.
- `frontend/src/components/` - Shared reusable UI components.
- `frontend/src/lib/` - Shared utilities, API clients, constants, and helper functions.
- `frontend/src/features/leads/` - Lead intake screens and lead workflows.
- `frontend/src/features/tours/` - Tour logging screens and related UI.
- `frontend/src/features/pipeline/` - Pipeline board UI.
- `frontend/src/features/analytics/` - Analytics dashboard UI.
- `frontend/src/features/reports/` - Reporting dashboard UI.
- `frontend/src/features/admin/` - Administration screens.

### `database/`

Database planning and setup files belong here.

- `database/init/` - Database initialization scripts.
- `database/schema/` - Schema notes, SQL files, ERD notes, or migration planning.
- `database/seeds/` - Seed data for local development and testing.

### `docs/`

Project documentation belongs here.

- `docs/project-scope-summary.md` - Summary of the project scope, technical direction, and delivery timeline.

### `scripts/`

Helper scripts for local development, setup, testing, or maintenance belong here.

## Environment Variables

Detailed model design, migration, setup, and verification instructions are available in [Data Models and Database Migrations](docs/data-models-and-migrations.md).

Accounts API, role permissions, and frontend login behavior are documented in [Accounts and Authentication](docs/authentication.md).

Start by copying the example environment file:

```bash
cp .env.example .env
```

Current variables:

```env
ENVIRONMENT=local
SECRET_KEY=replace-with-a-long-random-value
DEBUG=True
DATABASE_URL=postgresql://postgres:password@localhost:5432/ready_set_stem
API_BASE_URL=
```

## Delivery Timeline

- **Onboarding:** Jun 18 to Jun 24
- **Milestone 1, Core Foundation:** Jun 25 to Jul 8
- **Milestone 2, Analytics and Reporting:** Jul 9 to Jul 22
- **Live Trial:** Jul 23 to Jul 31
- **Final Wrap-Up and Delivery:** Aug 1 to Aug 7

## Development Status

This repository is currently a project scaffold. The folder structure is prepared around the expected React, Django, and PostgreSQL architecture, but framework-specific files should be added as implementation decisions are finalized.

Generated files such as `__pycache__/`, local `.env` files, virtual environments, build output, and dependency folders should not be committed.
