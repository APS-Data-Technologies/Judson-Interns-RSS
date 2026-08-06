# Ready Set STEM Operations

Ready Set STEM Operations is an internal application for managing prospective-family
tours from initial booking through enrollment or churn. It combines daily tour
operations, pipeline management, analytics, financial reporting, global search, and
role-aware administration.

## Technology

- React and Vite frontend
- Django REST Framework backend
- PostgreSQL database
- GitHub Actions validation
- Railway development and staging environments

Operational dates and times use `America/Chicago`. The backend keeps timezone-aware
timestamps in UTC and the user interface presents them in the location timezone.

## Repository structure

```text
.
├── .github/workflows/       Continuous integration
├── backend/                 Django API, domain apps, migrations, and tests
├── docs/                    Product and engineering documentation
├── frontend/                React application
├── .env.example             Backend environment template
└── README.md
```

The backend is divided into the `accounts`, `analytics`, `leads`, `pipeline`,
`reports`, `sites`, and `tours` applications. Frontend code is organized into shared
components, domain features, pages, API services, styles, and utilities.

## Local setup

### Backend

```bash
python -m venv backend/venv
source backend/venv/bin/activate
pip install -r backend/requirements.txt
cp .env.example .env
python backend/manage.py migrate
python backend/manage.py runserver
```

Use a local PostgreSQL database and set `DATABASE_URL` in `.env`. Local environment
files, databases, virtual environments, caches, build output, backups, and generated
working artifacts are intentionally excluded from Git.

### Frontend

```bash
cd frontend
npm ci
cp .env.example .env
npm run dev
```

Set `VITE_API_BASE_URL` to the backend API base URL, normally
`http://localhost:8000/api` for local development.

## Validation

```bash
cd frontend
npm run lint
npm run build

cd ../backend
python manage.py check
python manage.py test --verbosity 1 --noinput
python manage.py makemigrations --check --dry-run
python manage.py migrate --check

cd ..
git diff --check
```

Pull requests targeting `develop` run frontend and backend checks through GitHub
Actions. Merge only after both checks succeed.

## Documentation

- [Architecture](docs/architecture.md)
- [Authentication and roles](docs/authentication.md)
- [Data models and migrations](docs/data-models-and-migrations.md)
- [Database seeding](docs/database-seeding.md)
- [Deployment and rollback](docs/deployment-and-rollback.md)
- [Operations runbook](docs/operations-runbook.md)
- [Testing](docs/testing.md)
- [Application handbook](docs/user-handbook.md)
- [User guides](docs/user-guides/)

## Data and security

- Never commit `.env` files, credentials, private keys, database exports, or backups.
- Do not seed shared environments without explicit approval.
- Treat production setup and production data changes as separately authorized work.
- Create and manage user accounts through approved administrative procedures.
- Store company backups in company-controlled secure storage.
