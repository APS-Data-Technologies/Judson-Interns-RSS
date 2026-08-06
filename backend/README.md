# Backend

The backend is a Django REST Framework application backed by PostgreSQL.

Domain applications under `apps/` provide accounts and authorization, locations,
lead sources, tours and lifecycle events, pipeline behavior, analytics, and reports.
Django migrations are the authority for schema changes.

From the repository root:

```bash
python -m venv backend/venv
source backend/venv/bin/activate
pip install -r backend/requirements.txt
python backend/manage.py migrate
python backend/manage.py runserver
```

See the root README and `docs/` for environment, testing, authorization, data, and
deployment guidance. The optional demonstration seed is
`backend/seeds/rss_seed_data.sql`; never load it into a shared environment without
explicit approval.
