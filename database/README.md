# Database

PostgreSQL schema changes are managed through Django migrations. Repository seed data is stored as SQL rather than spreadsheet files.

## Seed Script

`database/seeds/rss_seed_data.sql` contains validated dummy data for users, locations, lead sources, families, tours, tour events, and cost basis records.

The script:

- Runs inside a PostgreSQL transaction.
- Uses stable `external_id` values.
- Can be rerun safely using `ON CONFLICT` handling.
- Keeps imported user passwords unusable until reset by a Super Admin.
- Does not contain database credentials.

Apply migrations first:

```bash
python backend/manage.py migrate
```

Load environment variables and execute the seed script:

```bash
set -a
source .env
set +a
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/seeds/rss_seed_data.sql
```

Do not commit `.env`, database credentials, production exports, or XLSX seed files.
