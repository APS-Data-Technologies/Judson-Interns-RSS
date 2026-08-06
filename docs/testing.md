# Testing and Validation

## Frontend

From `frontend/`:

```bash
npm ci
npm run lint
npm run build
```

The current repository does not include a frontend unit-test suite. Changes to
responsive behavior, forms, navigation, authentication, analytics, and PDF export
therefore require focused acceptance testing in addition to lint and build checks.

## Backend

From `backend/` with the environment configured:

```bash
python manage.py check
python manage.py test --verbosity 1 --noinput
python manage.py makemigrations --check --dry-run
python manage.py migrate --check
```

Backend tests are grouped with their Django applications under `apps/*/tests/`.

## Repository

From the repository root:

```bash
git diff --check
git status --short
```

Review the staged file list explicitly before committing. Do not stage local
environments, databases, backups, generated review files, or unrelated user work.

## Pull-request checks

`.github/workflows/ci.yml` runs two required jobs for pull requests targeting
`develop` or `main`:

- Backend Checks: installs dependencies, runs Django system checks, and executes the
  backend test suite against PostgreSQL 16.
- Frontend Checks: installs locked dependencies, runs ESLint, and creates the Vite
  production build.

Merge only after both jobs succeed.

## Acceptance coverage

Select checks according to the change, including:

- Staff, Admin, and Super Admin authorization boundaries;
- desktop/tablet and mobile layouts;
- tour creation, lifecycle changes, rescheduling, cancellation, and filters;
- Central Time input, display, daylight-saving behavior, and date boundaries;
- analytics authorization, drill-through, pagination, and PDF export;
- development and staging public routes and protected HTTP 401 behavior.
