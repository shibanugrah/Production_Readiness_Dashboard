# Production Readiness Dashboard

Production Readiness Dashboard is the foundation for a multi-tenant operational control plane. Its first job is to prove that the app can start reproducibly, validate configuration, connect to PostgreSQL, and expose a safe self-health endpoint.

This repository currently implements session-backed workspace access for the Phase 1 dashboard. It includes a workspace-scoped service registry domain, server-side service validation, local seed data, credentials-based demo authentication, Owner/Admin/Viewer permissions, a protected health-check runner, persisted health-check run history, service audit logs, and a data-driven monitoring dashboard UI.

An external scheduler such as n8n can call the protected scheduled-run endpoint, but no scheduler is configured by default. Incidents, deployment integrations, notifications, external monitoring integrations, invitations, password reset, OAuth, SSO, MFA, and billing are not built yet.

## Local Setup

Install dependencies:

```bash
npm install
```

Copy the environment template and fill in local values:

```bash
cp .env.example .env
```

For local Docker Compose usage, Prisma commands run from the host use `localhost` in `DATABASE_URL`. The application container receives values from `.env`, and Docker Compose overrides only the database hostname so the container can reach the `postgres` service. Do not commit real secrets.

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string used by Prisma and `/api/health`. |
| `AUTH_SECRET` | Local secret material reserved for auth/session configuration. Generate a unique value per environment. |
| `INTERNAL_HEALTH_CHECK_SECRET` | Secret required by the protected internal health-check runner route. |
| `NODE_ENV` | `development`, `test`, or `production`. |
| `APP_VERSION` | Optional application version reported by `/api/health`. |
| `HEALTH_CHECK_LOCAL_ALLOWLIST_ENABLED` | Enables local-only health-check targets when set to `true` with `APP_VERSION=local`. |
| `HEALTH_CHECK_LOCAL_ALLOWED_TARGETS` | Comma-separated `host:port` allowlist for local development checks such as `localhost:3000`. Production checks still reject local and private targets. |
| `DEMO_OWNER_EMAIL` | Email address used when seeding the local Owner account. |
| `DEMO_OWNER_PASSWORD` | Local-only password used to hash the seeded Owner account. Do not commit it. |
| `DEMO_ADMIN_EMAIL` | Email address used when seeding the local Admin account. |
| `DEMO_ADMIN_PASSWORD` | Local-only password used to hash the seeded Admin account. Do not commit it. |
| `DEMO_VIEWER_EMAIL` | Email address used when seeding the local Viewer account. |
| `DEMO_VIEWER_PASSWORD` | Local-only password used to hash the seeded Viewer account. Do not commit it. |

## Docker

Start PostgreSQL and the Next.js app:

```bash
docker compose up --build
```

Then verify the app:

```bash
curl http://localhost:3000/api/health
```

Stop the stack:

```bash
docker compose down
```

## Database

Generate the Prisma client:

```bash
npm run db:generate
```

Run migrations:

```bash
npm run db:migrate
```

Seed the local workspace and services:

```bash
npm run db:seed
```

The seed creates the `Portfolio Operations` workspace, demo Owner/Admin/Viewer users from local environment values, the dashboard service, the demo monitored service, and one inactive placeholder service. Passwords are hashed before storage; plaintext demo passwords must stay only in local `.env` files. The seed does not create health-check history; manual or scheduled runner calls create real `HealthCheckRun` records and linked `HealthCheck` rows.

## Authentication And Roles

Dashboard routes require a signed-in user. Sign in at `/signin` with one of the locally seeded demo accounts:

| Role | Local demo email source | Access |
| --- | --- | --- |
| Owner | `DEMO_OWNER_EMAIL` | Full workspace operator access for current local capabilities. |
| Admin | `DEMO_ADMIN_EMAIL` | Service management and health-check execution. |
| Viewer | `DEMO_VIEWER_EMAIL` | Read-only dashboard access. Mutation attempts are denied server-side. |

Use the matching local password from `.env`; the repository intentionally contains only placeholders. Sign out from the sidebar user panel.

Workspace access is resolved on the server from the authenticated session and `WorkspaceMember` rows. Browser-provided workspace IDs, user IDs, or roles are not trusted. Credentials-based demo authentication is suitable for local verification only and is not a complete enterprise identity system.

## Verification

Run the local checks:

```bash
npm run lint
npm run typecheck
npm run test
npm run db:generate
npm run db:migrate
npm run db:seed
```

## Dashboard Routes

Implemented routes:

| Route | Data shown |
| --- | --- |
| `/` | Overview readiness, active service counts, latest check cycle evidence, service cards, recent failed checks, operational-events empty state, and deployment-evidence placeholder. |
| `/services` | Real service list with filters, current persisted status, latest check latency, last checked, and last healthy timestamps. |
| `/services/[serviceId]` | Service detail, latest check result, check history, status-history strip, latest failure, and persisted configuration fields. |
| `/events` | Honest empty state; event ingestion is not connected yet. |
| `/incidents` | Honest empty state; incident workflow is not connected yet. |
| `/readiness` | Honest empty state; deployment readiness integration is not connected yet. |
| `/settings` | Honest empty state; workspace settings and auth are not connected yet. |

Every status, count, latency, failed-check row, run summary, and service card is calculated from persisted `Service`, `HealthCheckRun`, and `HealthCheck` rows. Services with no persisted checks are shown as `Unknown`, even if they were created successfully. The dashboard does not fabricate uptime percentages, incident rows, owners, readiness scores, deployment history, scheduler status, or static telemetry.

Scheduled monitoring status is evidence-based. Overview and Settings show n8n scheduling as active only after a real persisted `SCHEDULED` `HealthCheckRun` exists for the signed-in workspace.

## Health Endpoint

`GET /api/health` returns HTTP 200 when the app is configured and PostgreSQL is reachable:

```json
{
  "status": "ok",
  "service": "production-readiness-dashboard",
  "version": "local-or-app-version",
  "timestamp": "ISO-8601 timestamp",
  "database": "connected"
}
```

When configuration validation or database connectivity fails, it returns HTTP 503 with a stable safe response:

```json
{
  "status": "error",
  "service": "production-readiness-dashboard",
  "version": "local-or-app-version",
  "timestamp": "ISO-8601 timestamp",
  "database": "unavailable"
}
```

The health response does not expose secrets, stack traces, connection strings, or internal database details.

## Demo Monitored Endpoint

`GET /api/demo-service/health` is available for local development. Docker Compose enables it with `DEMO_SERVICE_HEALTH_ENABLED=true` so the standalone app can simulate the response shapes the future runner will observe:

```bash
curl "http://localhost:3000/api/demo-service/health?mode=healthy"
curl "http://localhost:3000/api/demo-service/health?mode=slow"
curl "http://localhost:3000/api/demo-service/health?mode=down"
curl "http://localhost:3000/api/demo-service/health?mode=invalid"
```

Modes:

| Mode | Result |
| --- | --- |
| `healthy` | HTTP 200 with valid health JSON and `status: "ok"`. |
| `slow` | Waits about 2 seconds, then returns the valid health JSON. |
| `down` | HTTP 503 with a safe JSON error response. |
| `invalid` | HTTP 200 with an invalid health payload that does not contain `status: "ok"`. |

Unsupported modes return HTTP 400. In production mode, controllable demo modes are disabled.

## Run A Health-Check Cycle Locally

Owner and Admin users can run checks from the local dashboard UI. Those manual runs create `HealthCheckRun` records with `triggerType=MANUAL` and the requesting user recorded server-side.

The internal scheduled-run boundary is protected by `INTERNAL_HEALTH_CHECK_SECRET`. Use the value already in your local `.env`; do not print or commit it.

From PowerShell, after `docker compose up --build -d`, you can load the local secret into memory and call the runner:

```powershell
$secret = (Get-Content .env | Where-Object { $_ -match '^INTERNAL_HEALTH_CHECK_SECRET=' }) -replace '^INTERNAL_HEALTH_CHECK_SECRET="?([^"]+)"?$', '$1'
curl.exe -X POST http://localhost:3000/api/internal/health-checks/scheduled-run -H "x-internal-health-check-secret: $secret"
```

The route creates a `HealthCheckRun` with `triggerType=SCHEDULED` and no user identity, runs checks for stored services, links each created `HealthCheck` row to that run, and persists summary counts. Active services create `HealthCheck` rows and update their current `Service.status`; inactive services are skipped. Historical failures remain after later recovery.

To test demo scenarios locally, update the demo service `healthPath` in the database, run the protected route again, then restore it:

```powershell
# healthy
/api/demo-service/health?mode=healthy

# slow/degraded
/api/demo-service/health?mode=slow

# down/failure
/api/demo-service/health?mode=down

# invalid payload/failure
/api/demo-service/health?mode=invalid
```

Checks are not scheduled automatically yet. The local demo uses manual runs by default, and production scheduling requires an external scheduler to call the protected scheduled-run endpoint. An importable n8n template lives at `docs/n8n/production-readiness-scheduled-health-check.json`, with setup steps in `docs/runbooks/n8n-scheduled-health-check-setup.md` and endpoint behavior in `docs/runbooks/health-check-scheduler.md`. The internal secret is never sent to the browser.

Expected scheduler behavior:

| Response | Meaning |
| --- | --- |
| `2xx` | Normal scheduled run completion. |
| `409` | Safe overlap; another workspace run was active, so wait for the next interval. |
| `401` or `403` | Configuration or security failure; review the n8n credential and app secret. |
| `5xx` or network failure | Retry-worthy failure according to normal n8n retry policy. |

The n8n workflow is optional and not connected until it is imported, configured with safe credentials, tested, and activated in n8n.

Safe verification steps:

```powershell
npm run db:generate
npm run db:migrate
npm run db:seed
npm run lint
npm run typecheck
npm run test
docker compose up --build -d
curl.exe http://localhost:3000/api/health
docker compose ps
```
