# Architecture

## System overview

Ready Set STEM Operations is a three-service web application:

```text
Browser -> React frontend -> Django REST API -> PostgreSQL
```

The frontend and backend are independently built and deployed. PostgreSQL is the
system of record. GitHub Actions validates pull requests, and Railway hosts the
development and staging environments.

## Backend

The Django project configuration is under `backend/config/`. Business capabilities
are separated into applications under `backend/apps/`:

- `accounts`: authentication, users, roles, tokens, and authorization;
- `sites`: Ready Set STEM locations;
- `leads`: lead-source configuration;
- `tours`: families, tours, lifecycle events, and follow-up operations;
- `pipeline`: pipeline-domain support;
- `analytics`: authorized metrics, rankings, drill-through, and export data;
- `reports`: cost-basis and reporting APIs.

All protected API access is enforced by backend authentication and permissions. The
frontend route guards improve navigation but are not a security boundary.

## Frontend

The React application is under `frontend/src/`:

- `components/`: shared interface building blocks;
- `features/`: API clients and domain behavior;
- `pages/`: route-level screens;
- `services/`: shared API configuration;
- `styles/`: global design, layout, responsive, and status tokens;
- `utils/`: shared display and timezone behavior.

The interface has two supported responsive modes: desktop/tablet navigation and a
mobile layout with bottom navigation and mobile-specific composition.

## Data and time

Django migrations define the schema. PostgreSQL stores application data. Operational
tour input and display use the location timezone, currently `America/Chicago`.
Timezone-aware timestamps are retained in UTC at the storage boundary.

## Environments

- Local development uses developer-controlled configuration and data.
- Railway development and staging have separate environment configuration and
  PostgreSQL services.
- Production is separately authorized and must not be inferred from development or
  staging procedures.

Never copy data, credentials, accounts, or environment variables between environments
without explicit approval.
