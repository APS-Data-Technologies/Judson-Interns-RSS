# Ready Set STEM Railway Deployment Handover

This package explains how Ready Set STEM can reproduce the application in its own
Railway workspace. It intentionally contains variable names and procedures, but no
passwords, tokens, connection strings, account credentials, or other secret values.

## Company decisions required before live data

The repository establishes the company/product name as **Ready Set STEM**. The
following values cannot be safely inferred from the repository and must be recorded
in a company-controlled system before launch:

| Decision | Required company record |
| --- | --- |
| Business owner | Named approver for product and data decisions |
| Technical owner | Named maintainer for GitHub, Railway, and releases |
| Railway administrators | At least two company employees |
| Incident contact | Primary and secondary escalation contacts |
| DNS owner | Registrar/DNS provider and authorized administrator |
| Frontend domain | Approved production HTTPS hostname |
| Backend domain | Approved production API HTTPS hostname |
| Email owner | Approved sender domain, provider, and administrator |
| Backup owner | Person accountable for backup monitoring and restore tests |
| Recovery policy | Approved RPO, RTO, retention, and restore-test frequency |

Do not place personal phone numbers, private email addresses, credentials, or secret
values in this repository. Store contact details and access records in the company's
approved internal system. Until the company selects custom hostnames, use the
Railway-generated frontend and backend domains and update all related variables
together when the custom domains are introduced.

## 1. Ownership and isolation

The company must own and administer:

- the GitHub organization and repository;
- the Railway workspace, project, billing, services, and variables;
- the production PostgreSQL database and backup policy;
- DNS and custom domains;
- email-delivery configuration;
- production Super Admin accounts and recovery procedures; and
- deployment approval and incident-response contacts.

Create company production independently. Do not copy databases, credentials,
accounts, or raw secret values from development, staging, or the reference
production environment. Add at least two company Railway administrators and never
share personal Railway or GitHub logins.

## 2. Release and branch model

| Environment | Source branch | Purpose |
| --- | --- | --- |
| Development | `develop` | Integration and engineering validation |
| Staging | `develop` | Company acceptance before release |
| Production | `main` | Company live environment |

Current reference production release:

- branch: `main`
- release commit: `2181fdcb8a0c72dd9b9a31d027acc8ae8bceb540`
- short commit: `2181fdc`

Protect `main`: require pull requests, required Backend Checks and Frontend Checks,
an authorized approval, and prohibit force pushes. A release must identify its
commit, migrations, database impact, validation evidence, and rollback plan.

## 3. Railway service structure

Create one isolated Railway production environment with:

```text
Production
├── Postgres
├── backend
└── frontend
```

### PostgreSQL

1. Add a new Railway PostgreSQL service.
2. Start with an empty database.
3. Do not run `backend/seeds/rss_seed_data.sql` in production.
4. Do not import development, staging, or reference-production data.
5. Configure company-approved backups and perform a restore test before storing
   important data. The reference Railway Hobby workspace does not provide database
   backups/PITR; it is not an acceptable backup plan for company live data. Company
   production must use a Railway plan with the required recovery capability or an
   approved encrypted external backup and restore process.

### Backend

| Setting | Value |
| --- | --- |
| Repository | Company-owned repository |
| Branch | `main` |
| Root directory | `/backend` |
| Builder | Repository `Dockerfile.railway` |
| Pre-deploy command | `python manage.py migrate` |
| Health-check path | `/api/health` |
| Wait for CI | Enabled |

The image starts Gunicorn on Railway's `$PORT`. The current Dockerfile also runs
`python manage.py migrate` before Gunicorn as a defensive startup step. Keep one
backend replica with this release. Before horizontal scaling, make a reviewed
change that leaves migrations solely in Railway's pre-deploy phase.

### Frontend

| Setting | Value |
| --- | --- |
| Repository | Company-owned repository |
| Branch | `main` |
| Root directory | `/frontend` |
| Builder | Repository `Dockerfile.railway` |
| Health-check path | `/` |
| Wait for CI | Enabled |

`VITE_API_BASE_URL` is applied at build time. Changing it requires a frontend
redeployment.

## 4. Environment-variable inventory

Set new company-owned values in the indicated Railway service. Do not copy values
from another environment or store values in documentation.

### Backend variables

| Variable | Secret | Purpose |
| --- | --- | --- |
| `SECRET_KEY` | Yes | New high-entropy Django signing secret |
| `DEBUG` | No | Must be `False` in production |
| `DATABASE_URL` | Yes | Railway reference to the production PostgreSQL service |
| `ALLOWED_HOSTS` | No | Backend public domain plus required Railway internal/health-check hosts |
| `CORS_ALLOWED_ORIGINS` | No | Exact HTTPS frontend origin |
| `CSRF_TRUSTED_ORIGINS` | No | Exact trusted HTTPS frontend and backend origins |
| `AUTH_TOKEN_TTL_HOURS` | No | Company-approved authentication-token duration |
| `PASSWORD_RESET_TOKEN_TTL_SECONDS` | No | Password-reset link lifetime |
| `PASSWORD_RESET_FRONTEND_URL` | No | Production frontend reset-password base URL |
| `DEFAULT_FROM_EMAIL` | No | Company-approved sender address |
| `EMAIL_BACKEND` | No | Approved Django email backend when email delivery is enabled |

Use a Railway reference for `DATABASE_URL`, not a copied raw connection string.
If SMTP delivery is introduced, its provider-specific host, port, username,
password, and TLS settings must be reviewed against the application settings before
launch and stored only in Railway or the company's approved secret manager.

### Frontend variables

| Variable | Secret | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | No | HTTPS production backend URL ending in `/api` |

### Secret rules

- Generate independent secrets for company production.
- Never commit `.env` files or paste secret values into tickets, chat, or handoffs.
- Never reuse development, staging, reference-production, or personal credentials.
- Record the variable owner and rotation procedure, not the value.

## 5. Migration and data rules

Railway production pre-deploy command:

```bash
python manage.py migrate
```

Before release, CI or an approved workstation must run:

```bash
cd backend
python manage.py makemigrations --check --dry-run
python manage.py migrate --plan
python manage.py check
python manage.py test --verbosity 1 --noinput
```

Rules:

- Commit and review every migration.
- State schema and data impact in the release pull request.
- Back up affected company data before an approved destructive or bulk operation.
- Do not reverse an applied migration without a reviewed recovery plan.
- Prefer a tested forward corrective migration.
- Never seed production unless the company separately and explicitly authorizes the
  exact data and environment.

## 6. Role and permission matrix

| Capability | Staff | Admin | Super Admin |
| --- | --- | --- | --- |
| Sign in, sign out, restore session, change own password | Yes | Yes | Yes |
| Access assigned-location operational data | Yes | Yes | Yes |
| Access every location | No | Yes | Yes |
| Open application administration | No | Yes | Yes |
| Access authorized analytics across locations | No | Yes | Yes |
| List, create, edit, and deactivate users | No | No | Yes |
| Assign Staff to an active location | No | No | Yes |
| Manage account roles and administrative password resets | No | No | Yes |
| Access Django Admin | No | No | Yes |

Additional rules:

- Staff must be assigned to one active location.
- Admin and Super Admin accounts have cross-location access and no single-location
  assignment.
- User deletion through the application deactivates the account and invalidates its
  token; it does not erase the database record.
- A Super Admin cannot deactivate or demote their own account.
- There is no public signup. Create the first Super Admin only through an authorized
  secure procedure, then provision other accounts through the application.
- Never include account passwords in this package.

## 7. Production validation checklist

Record the production domain, release commit, deployment identifiers, validator,
date, and result for every release.

### Deployment and infrastructure

- [ ] Backend and frontend deployed from the intended `main` commit.
- [ ] Backend Checks and Frontend Checks completed successfully.
- [ ] PostgreSQL is online and references the production database.
- [ ] Migration pre-deploy completed successfully.
- [ ] Backend `/api/health` returns HTTP 200.
- [ ] Frontend root returns HTTP 200 over HTTPS.
- [ ] Railway and custom-domain TLS certificates are valid.
- [ ] Frontend bundle points to the production backend `/api` URL.
- [ ] No development or staging URL remains in production configuration.
- [ ] No demo seed data or unapproved account exists.

### Security and authorization

- [ ] An unauthenticated protected endpoint such as `/api/tours/` returns HTTP 401.
- [ ] CORS permits the exact production frontend origin.
- [ ] Staff can access only their assigned location.
- [ ] Admin can access cross-location operations and authorized analytics but cannot
      manage users.
- [ ] Super Admin can manage users and access Django Admin.
- [ ] Inactive users cannot authenticate.
- [ ] Password change rotates the authentication token.
- [ ] No credentials, tokens, or raw database URLs appear in logs or documentation.

### Application acceptance

- [ ] Home, Tours, New Tour, Tour Details, Pipeline, Analytics, Admin, and Account
      routes load for authorized roles.
- [ ] New Tour validates required fields and preserves optional `student_name`.
- [ ] Exact family-name reuse and duplicate-family behavior match the documented
      contract.
- [ ] The five-stage lifecycle works and Rescheduled/Cancelled badges are correct.
- [ ] Tours and Pipeline date filters use the Illinois location timezone.
- [ ] Stored timestamps and displayed Illinois times are correct across CST/CDT.
- [ ] RSS Assistant behavior matches authorized data and role boundaries.
- [ ] Analytics authorization, drill-through, filtering, and pagination work.
- [ ] PDF export contains its cover page and all authorized pages/data.
- [ ] PDF export/download is verified on desktop and physical mobile Safari.
- [ ] Any temporary validation records are removed after acceptance.

### Operations and recovery

- [ ] Backup retention and ownership are approved.
- [ ] A restore test has succeeded and is recorded.
- [ ] Company administrators can view deployments, logs, and metrics.
- [ ] The last known-good release and rollback procedure are recorded.
- [ ] At least two company administrators can operate Railway independently.
- [ ] Internship/personal accounts are removed after written acceptance.

## 8. Release and rollback procedure

1. Merge feature work into `develop` only after required checks pass.
2. Validate the merge in Railway development, then staging.
3. Record PostgreSQL status, public routes, authorization boundaries, migrations,
   and acceptance evidence.
4. Open and approve a release pull request from `develop` to `main`.
5. Merge only after required checks and staging acceptance succeed.
6. Record the `main` merge commit and monitor production frontend/backend until
   Railway reports success and PostgreSQL remains online.
7. Run the production validation checklist above.

For an application regression, redeploy the last company-approved known-good
commit. Do not roll back or edit applied database migrations blindly. Preserve logs
and prepare a forward corrective migration or explicitly approved recovery plan.

## 9. Handover acceptance

The company should demonstrate that it can independently:

- deploy an approved `main` commit;
- identify the commit running in each Railway service;
- inspect frontend and backend logs;
- run and verify migrations;
- validate health and authentication boundaries;
- create, deactivate, and authorize users correctly;
- rotate a configuration variable safely;
- perform a rollback; and
- restore a database backup.

Handover is complete only after company ownership, access, billing, domains,
backups, release procedure, and operational acceptance are recorded in a
company-controlled system.
