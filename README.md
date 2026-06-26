# Production Readiness Dashboard

Production Readiness Dashboard is the foundation for a multi-tenant operational control plane. Its first job is to prove that the app can start reproducibly, validate configuration, connect to PostgreSQL, and expose a safe self-health endpoint.

This repository currently implements Phase 1C. It includes a workspace-scoped service registry domain, server-side service validation, local seed data, a protected health-check runner, persisted health-check evidence, and a data-driven monitoring dashboard UI.

Authentication, scheduled checks, incidents, deployment integrations, notifications, and external monitoring integrations are not built yet.

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
| `AUTH_SECRET` | Placeholder for future auth/session signing. |
| `INTERNAL_HEALTH_CHECK_SECRET` | Placeholder for future protected internal check runner. |
| `NODE_ENV` | `development`, `test`, or `production`. |
| `APP_VERSION` | Optional application version reported by `/api/health`. |
| `HEALTH_CHECK_LOCAL_ALLOWLIST_ENABLED` | Enables local-only health-check targets when set to `true` with `APP_VERSION=local`. |
| `HEALTH_CHECK_LOCAL_ALLOWED_TARGETS` | Comma-separated `host:port` allowlist for local development checks such as `localhost:3000`. Production checks still reject local and private targets. |

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

The seed creates the `Portfolio Operations` workspace, a stable local owner membership, the dashboard service, the demo monitored service, and one inactive placeholder service. It does not create health-check history; the protected runner creates real check history.

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
| `/` | Overview readiness, active service counts, service cards, recent failed checks, operational-events empty state, and deployment-evidence placeholder. |
| `/services` | Real service list with filters, current persisted status, latest check latency, last checked, and last healthy timestamps. |
| `/services/[serviceId]` | Service detail, latest check result, check history, status-history strip, latest failure, and persisted configuration fields. |
| `/events` | Honest empty state; event ingestion is not connected yet. |
| `/incidents` | Honest empty state; incident workflow is not connected yet. |
| `/readiness` | Honest empty state; deployment readiness integration is not connected yet. |
| `/settings` | Honest empty state; workspace settings and auth are not connected yet. |

Every status, count, latency, failed-check row, and service card is calculated from persisted `Service` and `HealthCheck` rows. Services with no persisted checks are shown as `Unknown`, even if they were created successfully. The dashboard does not fabricate uptime percentages, incident rows, owners, readiness scores, deployment history, or static telemetry.

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

The internal runner is protected by `INTERNAL_HEALTH_CHECK_SECRET`. Use the value already in your local `.env`; do not print or commit it.

From PowerShell, after `docker compose up --build -d`, you can load the local secret into memory and call the runner:

```powershell
$secret = (Get-Content .env | Where-Object { $_ -match '^INTERNAL_HEALTH_CHECK_SECRET=' }) -replace '^INTERNAL_HEALTH_CHECK_SECRET="?([^"]+)"?$', '$1'
curl.exe -X POST http://localhost:3000/api/internal/health-checks/run -H "x-internal-health-check-secret: $secret"
```

The route runs checks for stored services. Active services create `HealthCheck` rows and update their current `Service.status`; inactive services are skipped. Historical failures remain after later recovery.

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

Checks are not scheduled automatically yet. The dashboard can trigger checks only in local demo mode through a server action that calls the runner server-side; the internal secret is never sent to the browser.
