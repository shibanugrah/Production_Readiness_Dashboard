# Production Readiness Dashboard

Production Readiness Dashboard is the foundation for a multi-tenant operational control plane. Its first job is to prove that the app can start reproducibly, validate configuration, connect to PostgreSQL, and expose a safe self-health endpoint.

This repository currently implements Phase 1A. It includes a workspace-scoped service registry domain, server-side service validation, local seed data, the dashboard self-health endpoint, and a development-only demo monitored health endpoint.

Automatic health checks, persisted check history, dashboard UI, authentication, and external monitoring integrations are not built yet.

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

Remove the local database volume when you need a clean database:

```bash
docker compose down -v
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

Seed the local Phase 1A workspace and services:

```bash
npm run db:seed
```

The seed creates the `Portfolio Operations` workspace, a stable local owner membership, the dashboard service, the demo monitored service, and one inactive placeholder service. It does not create health-check history; real check execution and persistence belong to a future runner task.

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
