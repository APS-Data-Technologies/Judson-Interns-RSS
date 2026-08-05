# Operations Runbook

## Routine delivery

1. Create a feature branch from current `develop`.
2. Make scoped changes without committing local environments, backups, or generated
   working files.
3. Run the validation described in `docs/testing.md`.
4. Open a pull request targeting `develop`.
5. Document implementation, validation, migration/database impact, and deployment
   checks in the pull request.
6. Wait for the required frontend and backend checks.
7. Merge only after both checks succeed.
8. Record the merge commit and monitor Railway development, then staging.

Never push directly to `develop` unless the repository owner explicitly approves it.

## Post-merge validation

For development and then staging:

1. Confirm the frontend and backend deployments correspond to the merge.
2. Wait until both deployments are active and successful.
3. Confirm PostgreSQL is online.
4. Verify the backend root and `/api/`.
5. Verify the frontend root and `/tours`.
6. Confirm a protected endpoint returns HTTP 401 without authentication.

Do not seed data, create accounts, reveal credentials, or modify production as part
of deployment monitoring.

## User administration

- There is no public signup.
- Super Admins provision accounts through the approved administration workflow.
- Never send passwords through source control, documentation, tickets, or chat.
- Disable access promptly when a staff member no longer requires the application.

See `docs/authentication.md` for the role and permission model.

## Database changes

- Use Django migrations for schema changes.
- Run migration checks before opening a pull request.
- State migration and data impact explicitly in the pull request.
- Back up affected company data before an approved destructive or bulk operation.
- Never load `backend/seeds/rss_seed_data.sql` into a shared environment without
  explicit authorization.

## Incident and rollback

1. Record the affected environment, release commit, symptoms, and start time.
2. Stop further changes and preserve relevant logs.
3. Determine whether the failure is frontend, backend, configuration, or database.
4. For an application-only regression, redeploy the last known-good commit using the
   company-approved Railway procedure.
5. Do not reverse or edit applied migrations blindly. Prepare and validate a forward
   corrective migration or an explicitly approved rollback plan.
6. Verify service health, public routes, authentication boundaries, and the affected
   user workflow after recovery.
7. Document the resolution and any follow-up action.

Production rollback and database restoration require company authorization.

## Ownership checklist

The company should maintain ownership of:

- GitHub organization and repository administration;
- Railway project, services, environment variables, and billing;
- database backups and retention policy;
- domain and email-provider configuration;
- Super Admin access and account recovery;
- incident contacts and deployment approval.
