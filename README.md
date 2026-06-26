# Production Readiness Dashboard

Production Readiness Dashboard is the foundation for a multi-tenant operational control plane. Its first job is to prove that the app can start reproducibly, validate configuration, connect to PostgreSQL, and expose a safe self-health endpoint.

This repository currently implements Phase 0 only. Monitoring services, workspace auth, service registry, dashboard modules, and telemetry history are not built yet.

## Local Setup

Install dependencies:

```bash
npm install
```

Copy the environment template and fill in local values:

```bash
cp .env.example .env
```

For local Docker Compose usage, the application container receives development-safe values from `docker-compose.yml`. Do not commit real secrets.

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

Run the Phase 0 seed placeholder:

```bash
npm run db:seed
```

Phase 0 intentionally does not create dashboard domain tables. The self-health endpoint verifies database connectivity with a safe `SELECT 1`.

## Verification

Run the local checks:

```bash
npm run lint
npm run typecheck
npm run test
npm run db:generate
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
