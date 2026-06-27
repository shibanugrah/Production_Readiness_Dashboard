# Production Deployment Runbook

This runbook defines the provider-neutral release contract for Production Readiness Dashboard. It does not create cloud accounts, provision infrastructure, configure n8n, or run a deployment automatically.

## A. Deployment Order

1. Configure a managed production PostgreSQL database.
2. Configure production environment variables from `.env.production.example` in the chosen hosting provider's secret store.
3. Build the application artifact or container.
4. Apply checked-in migrations only:

   ```powershell
   npm run db:migrate
   ```

5. Confirm migration state:

   ```powershell
   npm run db:migrate:status
   ```

6. Start or release the application.
7. Verify:

   ```http
   GET /api/health
   ```

   The response must report `database: "connected"`.

8. Sign in with the intentionally configured production demo account only after application access and health are confirmed.

## B. Required Production Checks

- `GET /api/health` returns HTTP 200 and `database: "connected"`.
- `HEALTH_CHECK_LOCAL_ALLOWLIST_ENABLED` is `false`.
- `HEALTH_CHECK_LOCAL_ALLOWED_TARGETS` is empty.
- `DEMO_SERVICE_HEALTH_ENABLED` is not `true`, so controllable demo health modes are not publicly exposed.
- Owner/Admin/Viewer authorization still works after release.
- Viewer mutation denial still works server-side.
- The chosen hosting provider terminates HTTPS before user traffic reaches the app.
- No secrets appear in client bundles, logs, screenshots, repository files, or support artifacts.

## C. Migration Safety

- Use `npm run db:migrate`, never `db:migrate:dev`, in deployment, CI, Docker verification, and clean-clone setup.
- Inspect generated migration SQL before deployment.
- Do not use `prisma db push` for this tracked-schema workflow.
- Prefer backward-compatible migrations before releasing code that depends on them.
- Roll back application code carefully if needed; do not roll back database migrations blindly. First inspect whether the migration is reversible and whether production data would be lost.

## D. Seed-Data Policy

`npm run db:seed` is for explicit first-time demo initialization only. It must never run automatically on every deployment, in container startup, or in CI release steps.

The current seed script is idempotent for the demo workspace, demo users, workspace memberships, and seeded services because it uses upsert/delete guards for those known records. It updates demo user password hashes from the environment and upserts the three demo services. It does not create health-check history, operational events, incidents, or audit history for normal dashboard evidence.

Manual one-time command, only after deciding that production demo data is intentional:

```powershell
npm run db:seed
```

Expected behavior: the `Portfolio Operations` workspace, Owner/Admin/Viewer demo users, and three demo services are created or updated from the configured environment values.

## E. Scheduler Policy

n8n is not configured by default. Scheduled monitoring is active only after a real n8n workflow execution calls the protected scheduled-run endpoint and creates persisted `SCHEDULED` `HealthCheckRun` evidence.

Scheduler credentials belong only in n8n credential storage or protected n8n environment variables. Do not paste `INTERNAL_HEALTH_CHECK_SECRET` into workflow descriptions, screenshots, README snippets, logs, or repository files.

## F. Rollback And Incident Response

App health failure:
Stop the release, inspect application logs for safe error names, confirm environment variables are present, then verify database reachability from the hosting network. Do not print `DATABASE_URL` or secret values while debugging.

Migration failure:
Do not start the new application version. Capture the failed migration name, inspect the SQL and Prisma migration table, and decide whether to fix forward with a new migration or restore from a database backup. Do not run destructive reset commands.

Wrong secret or configuration:
Rotate the affected secret in the provider secret store, restart the application, and invalidate any exposed credential. If the internal health-check secret changed, update n8n credential storage only.

Failed scheduler calls:
Check the scheduled-run endpoint response code, n8n credential binding, app health, and overlap behavior. A `409` means a run was already active; wait for the next interval rather than retrying aggressively.

Accidental ingest-key exposure:
Revoke the exposed ingestion key from Settings, create a new source-specific key, update the integration, and audit recent operational events for unexpected source activity.
