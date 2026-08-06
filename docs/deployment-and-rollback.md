# Deployment and Rollback

This project uses separate Railway development, staging, and production
environments. Each environment contains three services:

- `postgres`: Railway PostgreSQL
- `backend`: Django API
- `frontend`: React SPA

## 1. Repository requirements

The backend now supports Railway production deployment with:

- `gunicorn` for the Django web server
- `whitenoise` for Django static assets
- env-driven `ALLOWED_HOSTS`
- env-driven `CORS_ALLOWED_ORIGINS`
- env-driven `CSRF_TRUSTED_ORIGINS`
- `/api/health` health endpoint

The frontend now supports Railway deployment with:

- `npm run build` to generate `dist`
- `npm run start` to serve the SPA from `dist`

Production deploys from `main`. Development and staging deploy from `develop`.
Ready Set STEM company production must be recreated in a company-owned Railway
workspace with company-owned secrets, domains, billing, database, and accounts. See
`docs/company-deployment-handover.md` for the complete company deployment package.

## Current production release

- source branch: `main`
- release commit: `2181fdcb8a0c72dd9b9a31d027acc8ae8bceb540`
- release commit short form: `2181fdc`
- release tree: identical to validated `develop` commit
  `8b567f075b5d8539e7e179da120989e4cc5fd2ff`
- frontend: `https://frontend-production-e358.up.railway.app`
- backend: `https://backend-production-7988.up.railway.app`
- deployment validation: frontend and backend successful, PostgreSQL online,
  backend health HTTP 200, and unauthenticated protected endpoint HTTP 401

This release record contains no credentials. Account passwords and environment
variable values must never be added to this document.

## 2. Railway project structure

Each environment must have a PostgreSQL service plus backend and frontend services
connected to the company GitHub repository. Keep environment variables, secrets,
accounts, and data isolated between development, staging, and production.

## 3. Backend service settings

Service root directory:

```text
/backend
```

Build command:

```bash
pip install -r requirements.txt
python manage.py collectstatic --noinput
```

Start command:

```bash
gunicorn config.wsgi:application --bind 0.0.0.0:$PORT
```

Health check path:

```text
/api/health
```

Required variables:

```text
SECRET_KEY=<strong-random-value>
DEBUG=False
DATABASE_URL=${{Postgres.DATABASE_URL}}
ALLOWED_HOSTS=<backend-domain>.up.railway.app,api.<your-domain>
CORS_ALLOWED_ORIGINS=https://<frontend-domain>.up.railway.app,https://app.<your-domain>
CSRF_TRUSTED_ORIGINS=https://<backend-domain>.up.railway.app,https://api.<your-domain>
AUTH_TOKEN_TTL_HOURS=12
```

Notes:

- `DATABASE_URL` should reference the Railway PostgreSQL service variable, not a copied raw string.
- Include only real domains in `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, and `CSRF_TRUSTED_ORIGINS`.

## 4. Frontend service settings

Service root directory:

```text
/frontend
```

Build command:

```bash
npm install
npm run build
```

Start command:

```bash
npm run start
```

Required variables:

```text
VITE_API_BASE_URL=https://<backend-domain>.up.railway.app/api
```

## 5. Generate domains

For each web service:

1. Open the service in Railway.
2. Go to `Settings -> Networking -> Public Networking`.
3. Click `Generate Domain`.

Recommended layout:

- frontend public URL: `https://app.<your-domain>`
- backend public URL: `https://api.<your-domain>`

## 6. Initial environment setup

After the backend service is deployed:

1. Open the backend service shell in Railway.
2. Run migrations:

```bash
python manage.py migrate
```

3. Create the first Super Admin only when company authorization has been provided:

```bash
python manage.py createsuperuser
```

4. Do not load seed data unless the company explicitly approves it for that specific
   environment. The canonical optional seed file is
   `backend/seeds/rss_seed_data.sql`.

## 7. Ongoing deploy flow

- Feature pull requests target `develop`.
- Railway deploys validated changes to development and staging from `develop`.
- A reviewed release merge updates `main` only after required checks and staging
  acceptance succeed.
- Production backend and frontend deploy from `main`.
- Railway waits for required GitHub checks and the backend health check to succeed.

## 8. GitHub Actions and Railway autodeploy

This repository now includes a GitHub Actions workflow at:

- `.github/workflows/ci.yml`

The workflow runs on pushes and pull requests for `develop` and `main`.

Checks included:

- backend:
  - install Python dependencies
  - run `python manage.py check`
  - run Django tests against a GitHub Actions PostgreSQL service
- frontend:
  - run `npm ci`
  - run `npm run lint`
  - run `npm run build`

Recommended Railway service settings:

- `backend`
  - GitHub branch: `develop`
  - Root directory: `/backend`
  - Healthcheck path: `/api/health`
  - Pre-deploy command: `python manage.py migrate`
  - Wait for CI: enabled
- `frontend`
  - GitHub branch: `develop`
  - Root directory: `/frontend`
  - Wait for CI: enabled

Production uses the same settings except both web services connect to `main` and
use production-only variables, domains, database, and secrets.

## 9. Manual verification

Check these URLs after deployment:

- frontend: `https://<frontend-domain>`
- backend health: `https://<backend-domain>/api/health`
- Django admin: `https://<backend-domain>/admin/`
- API auth/login flow from the frontend

Also confirm a protected endpoint returns HTTP 401 when requested without
authentication.

## 10. Common issues

- `DisallowedHost`: add the deployed backend domain to `ALLOWED_HOSTS`
- CORS errors: add the frontend domain to `CORS_ALLOWED_ORIGINS`
- Admin login CSRF failure: add the backend HTTPS domain to `CSRF_TRUSTED_ORIGINS`
- Failed deploy health check: ensure Django is listening on `$PORT` and `/api/health` returns `200`

## 11. Rollback

1. Record the environment, failed merge commit, symptoms, and deployment identifiers.
2. Preserve deployment and application logs.
3. For an application-only regression, redeploy the last company-approved known-good
   commit through Railway.
4. Do not reverse an applied database migration without an explicit, reviewed data
   recovery plan. Prefer a tested forward corrective migration.
5. After recovery, verify frontend and backend deployment success, PostgreSQL online
   status, public routes, authentication boundaries, and the affected workflow.
6. Record the recovered commit and follow-up work.

Production rollback and database restoration require separate company approval.
