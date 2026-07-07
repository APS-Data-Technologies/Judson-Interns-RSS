# Data Models and Database Migrations

This document explains how the Ready Set STEM data model was designed, where the Django model and migration files are located, and how every developer can create or update the PostgreSQL schema consistently.

## 1. Architecture Overview

Django model classes are the source of truth for the application schema. Django migrations translate changes in those classes into database operations that PostgreSQL can apply.

Core imported models also include a nullable, unique `external_id`. This preserves stable source-system identifiers while Django's integer primary keys remain the internal relationship keys.

```text
Project requirements
        |
        v
Django model classes
        |
        |  python backend/manage.py makemigrations
        v
Migration files
        |
        |  python backend/manage.py migrate
        v
PostgreSQL tables, indexes, constraints, and foreign keys
```

The models are divided into apps by business responsibility:

| App | Model | PostgreSQL table | Purpose |
| --- | --- | --- | --- |
| `sites` | `Location` | `sites_location` | Ready Set STEM locations |
| `accounts` | `User` | `accounts_user` | Authentication, roles, and staff location assignment |
| `leads` | `LeadSource` | `leads_leadsource` | Sources that generate leads |
| `leads` | `Family` | `leads_family` | Family contact information |
| `tours` | `Tour` | `tours_tour` | Scheduled tours and their current status |
| `tours` | `TourEvent` | `tours_tourevent` | Historical tour status events |
| `reports` | `CostBasis` | `reports_costbasis` | Monthly costs by location and cost type |

The `analytics` and `pipeline` apps currently contain no database models, so they do not have migrations yet. They can use the tour and event data for calculations and workflow views.

## 2. Model Relationships

```text
Location 1 ---- many User
Location 1 ---- many Tour
Location 1 ---- many CostBasis

Family 1 ------ many Tour
LeadSource 1 -- many Tour
User 1 -------- many assigned Tour

Tour 1 -------- many TourEvent
User 1 -------- many TourEvent (updated_by)
```

`Tour.current_status` stores the latest status for fast list, pipeline, and reporting queries. `TourEvent` stores the history of status changes, including the responsible user and event time.

## 3. How the Models Were Created

### Location

File: `backend/apps/sites/models.py`

`Location` stores the location name, postal address, phone number, active state, and audit timestamps. The location name is unique. Indexes support active-location and city/state queries.

### Custom User

File: `backend/apps/accounts/models.py`

`User` extends Django's `AbstractUser`, retaining Django's password hashing, permissions, groups, and administration support. It makes these project-specific changes:

- Email is unique and is used for login instead of username.
- Role is restricted to `super_admin`, `admin`, or `staff`.
- A user can optionally be assigned to a location.
- Role and active state are indexed.

The project activates this model in `backend/config/settings.py`:

```python
AUTH_USER_MODEL = "accounts.User"
```

This setting must remain in place. Changing the user model after production data exists requires a carefully planned data migration.

### LeadSource and Family

File: `backend/apps/leads/models.py`

`LeadSource` identifies where a lead came from and prevents duplicate source names. `Family` stores the primary family name, email, phone, notes, and timestamps.

### Tour and TourEvent

File: `backend/apps/tours/models.py`

`Tour` connects a family, location, lead source, and assigned staff member. It also stores the scheduled date, child grade, and current status.

Allowed tour statuses are:

- `scheduled`
- `rescheduled`
- `toured`
- `enrolled`
- `churned`
- `cancelled`
- `no_show`

`TourEvent` records status history. Deleting a tour also deletes its events because those events have no meaning without their parent tour. Users and other referenced business records use `PROTECT`, preventing records that are still referenced from being accidentally deleted.

### CostBasis

File: `backend/apps/reports/models.py`

`CostBasis` records a cost amount for a location, reporting month, and cost type. Its database rules enforce that:

- Cost amounts cannot be negative.
- The same location, month, and cost type combination cannot be entered twice.

## 4. Initial Migrations

The following migration files were generated with Django 5.2.15:

| Migration | Dependency | Database operation |
| --- | --- | --- |
| `sites/0001_initial.py` | None | Creates `Location` |
| `leads/0001_initial.py` | None | Creates `Family` and `LeadSource` |
| `accounts/0001_initial.py` | Django `auth`; `sites/0001` | Creates the custom `User` |
| `tours/0001_initial.py` | `leads/0001`; `sites/0001`; custom user | Creates `Tour` and `TourEvent` |
| `reports/0001_initial.py` | `sites/0001` | Creates `CostBasis` |

Django reads these dependencies and applies migrations in a valid order automatically. Developers should not manually choose the order.

In addition to the project tables, Django applies built-in migrations for administration, authentication, content types, and sessions. Applied migrations are recorded in the PostgreSQL table `django_migrations`.

Migration files are source code and must be committed to Git. `__pycache__` directories and `.pyc` files are generated locally and must not be committed.

## 5. First-Time Database Setup

Run all commands from the repository root, `Judson-Interns-RSS/`.

### Create and activate a virtual environment

macOS or Linux:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

Windows PowerShell:

```powershell
py -m venv .venv
.venv\Scripts\Activate.ps1
```

Install backend dependencies:

```bash
python -m pip install -r backend/requirements.txt
```

### Configure environment variables

Create a local environment file from the committed template:

```bash
cp .env.example .env
```

On Windows PowerShell, use:

```powershell
Copy-Item .env.example .env
```

Update `.env` with local values:

```env
ENVIRONMENT=local
SECRET_KEY=replace-with-a-long-random-secret
DEBUG=True
DATABASE_URL=postgresql://USERNAME:PASSWORD@HOST:PORT/DATABASE_NAME
API_BASE_URL=
```

Use the PostgreSQL URL supplied by the database provider. Never place a real password in `.env.example`, source code, migration files, screenshots, or Git commits. The `.env` file is ignored by Git.

### Check configuration and apply migrations

```bash
python backend/manage.py check
python backend/manage.py migrate
```

`migrate` applies both Django's built-in migrations and the project migrations. Re-running it is safe: already applied migrations are skipped.

Optional: create an administrator account:

```bash
python backend/manage.py createsuperuser
```

Because this project uses email login, enter an email address and password when prompted.

## 6. Verify the Migration Result

Show migration status:

```bash
python backend/manage.py showmigrations
```

An applied migration has `[X]` beside it. Verify that no model changes or migrations are missing:

```bash
python backend/manage.py makemigrations --check --dry-run
python backend/manage.py migrate --check
```

Expected results:

- `makemigrations --check --dry-run` reports `No changes detected`.
- `migrate --check` exits successfully without reporting pending migrations.

Connect to the configured PostgreSQL database through Django:

```bash
python backend/manage.py dbshell
```

Inside `psql`, list and inspect the tables:

```sql
\dt
\d accounts_user
\d sites_location
\d leads_family
\d leads_leadsource
\d tours_tour
\d tours_tourevent
\d reports_costbasis
```

Check the migration records:

```sql
SELECT app, name, applied
FROM django_migrations
ORDER BY applied;
```

Exit `psql` with:

```text
\q
```

## 7. Making Future Model Changes

Use this process whenever a model is added or changed:

1. Update the appropriate `backend/apps/<app>/models.py` file.
2. Generate a new migration with `python backend/manage.py makemigrations`.
3. Read the generated migration and confirm it represents the intended change.
4. Apply it locally with `python backend/manage.py migrate`.
5. Run `python backend/manage.py check` and the two verification commands above.
6. Test the affected application behavior.
7. Commit the model change and its migration file together.

Example: adding a field to `Family` should generate a new file such as `backend/apps/leads/migrations/0002_*.py`. Do not replace `0001_initial.py` after it has been shared or applied to another database.

Do not manually edit PostgreSQL tables to implement application schema changes. A manual database change is not reproducible for other developers or deployments. Express the change in a Django model and migration instead.

## 8. Common Problems

### PostgreSQL connection failure

Confirm that `DATABASE_URL` has the correct username, password, host, port, and database name. Hosted PostgreSQL services may also require SSL. Do not print or commit the connection URL while troubleshooting.

### `No module named ...`

Activate the virtual environment and reinstall dependencies:

```bash
python -m pip install -r backend/requirements.txt
```

### Pending model changes

If `makemigrations --check --dry-run` reports changes, generate and review the missing migration:

```bash
python backend/manage.py makemigrations
python backend/manage.py migrate
```

### Migration history conflict

Do not delete migration records, drop schemas, fake migrations, or edit already-applied migration files without first understanding the affected database and its data. Migration repair can destroy data and should be reviewed by the team before execution.

## 9. Files That Belong in Git

Commit:

- Model files: `backend/apps/*/models.py`
- Migration files: `backend/apps/*/migrations/*.py`
- Admin registrations: `backend/apps/*/admin.py`
- App configuration: `backend/apps/*/apps.py`
- Django configuration: `backend/config/settings.py`
- Environment template: `.env.example`
- This documentation

Do not commit:

- `.env`
- Database passwords or complete private connection URLs
- `.venv/`
- `__pycache__/`
- `*.pyc`
- Private key and credential files
