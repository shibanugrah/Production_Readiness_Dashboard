# Production Deployment Runbook

This runbook defines the provider-neutral release contract for Production Readiness Dashboard. It does not create cloud accounts, provision infrastructure, configure n8n, or run a deployment automatically.

## A. Deployment Order

1. Configure a managed production PostgreSQL database.
2. Configure production environment variables from `.env.production.example` in the chosen hosting provider's secret store.
3. Build the application artifact or container.
4. Apply checked-in migrations only, after explicitly confirming a production write:

   ```powershell
   $env:CONFIRM_PRODUCTION_DB_WRITE="YES"; npm run db:production:migrate
   ```

5. Confirm migration state:

   ```powershell
   npm run db:production:status
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
- `PUBLIC_DEMO_ACCESS_ENABLED` is set to `true` only when the public demo has been prepared and verified.
- Owner/Admin/Viewer authorization still works after release.
- Viewer mutation denial still works server-side.
- Owner/Admin users can run the manual health-check action against persisted service configuration.
- Manual health-check runs create persisted `MANUAL` `HealthCheckRun` evidence without requiring local target allowlists.
- The chosen hosting provider terminates HTTPS before user traffic reaches the app.
- No secrets appear in client bundles, logs, screenshots, repository files, or support artifacts.

## C. Migration Safety

- Use `npm run db:production:status` for the read-only production migration check.
- Use `$env:CONFIRM_PRODUCTION_DB_WRITE="YES"; npm run db:production:migrate`, never `db:migrate:dev`, for production migrations.
- Local `.env` is for Docker and local development only. `.private/production-db.env` is an ignored operator-owned file for explicit production database commands and must contain only `DATABASE_URL`.
- The production database wrapper validates that URL as an external PostgreSQL target and passes it only to the child Prisma process so local `.env` cannot override the production command.
- Inspect generated migration SQL before deployment.
- Do not use `prisma db push` for this tracked-schema workflow.
- Migrations and seeding must be run manually and are never part of deployment startup.
- Prefer backward-compatible migrations before releasing code that depends on them.
- Roll back application code carefully if needed; do not roll back database migrations blindly. First inspect whether the migration is reversible and whether production data would be lost.
- No production secret should be copied into README, `.env.example`, source code, local `.env`, screenshots, logs, or Git.

## D. Seed-Data Policy

`npm run db:production:seed` is for explicit first-time demo initialization only. It must never run automatically on every deployment, in container startup, or in CI release steps.

The current seed script is idempotent for the local demo workspace, demo users, workspace memberships, and seeded services because it uses upsert/delete guards for those known records. When public-demo seed variables are present, it also upserts the isolated `Public Demo` workspace, a dedicated operator Owner, a passwordless Viewer, one active public self-monitor service, and one inactive failure/demo service. It does not create health-check history, operational events, incidents, or audit history for normal dashboard evidence.

Manual one-time command, only after deciding that production demo data is intentional:

```powershell
$env:CONFIRM_PRODUCTION_DB_WRITE="YES"; npm run db:production:seed
```

Expected behavior: configured demo workspaces, users, memberships, and services are created or updated from environment values. `HealthCheck`, `HealthCheckRun`, scheduler, event, incident, uptime, latency, and readiness evidence are not fabricated by the seed.

## E. Public Demo Preparation

Use this checklist only after the application is deployed and `/api/health` is reachable. Do not print secrets, credentials, or database URLs in terminals, logs, screenshots, or support artifacts.

1. Set the public-demo environment variables in Vercel: `PUBLIC_DEMO_ACCESS_ENABLED`, `PUBLIC_DEMO_APP_BASE_URL`, `PUBLIC_DEMO_VIEWER_EMAIL`, `PUBLIC_DEMO_OWNER_EMAIL`, and `PUBLIC_DEMO_OWNER_PASSWORD`.
2. Apply migrations only if this release introduced one. This public-demo hardening does not require a migration.
3. Run the seed explicitly once:

   ```powershell
   $env:CONFIRM_PRODUCTION_DB_WRITE="YES"; npm run db:production:seed
   ```

4. Sign in as the public demo Owner.
5. Confirm the `Public Demo` workspace contains only public-safe services.
6. Confirm the normal active service is `Production Readiness Dashboard`, uses `PUBLIC_DEMO_APP_BASE_URL`, `/api/health`, and the deployed `APP_VERSION`.
7. Confirm intentional failure/demo services are inactive by default.
8. Run one manual check from the dashboard.
9. Confirm the self-monitor service is truly `HEALTHY` with a persisted recent manual result.
10. Confirm scheduler remains `Not configured` and no scheduled-run evidence exists for the public demo.
11. Test `Explore read-only demo`.
12. Confirm Viewer cannot mutate services, trigger checks, create incidents, triage events, or access sensitive settings.

## F. Scheduler Policy

n8n is not configured by default. Scheduled monitoring is active only after a real n8n workflow execution calls the protected scheduled-run endpoint and creates persisted `SCHEDULED` `HealthCheckRun` evidence.

Scheduler credentials belong only in n8n credential storage or protected n8n environment variables. Do not paste `INTERNAL_HEALTH_CHECK_SECRET` into workflow descriptions, screenshots, README snippets, logs, or repository files.

## G. Rollback And Incident Response

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
