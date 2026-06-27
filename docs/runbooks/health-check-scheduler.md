# Health-Check Scheduler Runbook

The dashboard is scheduler-ready, but no external scheduler is configured by default. Manual runs from the app and scheduled runs from this endpoint both create persisted `HealthCheckRun` records and link each generated `HealthCheck` row to that parent run.

## Endpoint

Send scheduled cycles to:

```http
POST /api/internal/health-checks/scheduled-run
```

The caller must include the internal secret in one of these forms:

```http
x-internal-health-check-secret: <secret stored in scheduler credentials>
Authorization: Bearer <secret stored in scheduler credentials>
```

The expected secret comes from `INTERNAL_HEALTH_CHECK_SECRET` in the application environment. Store it in the scheduler credential store. Do not paste it into workflow node text, logs, screenshots, README examples, or source control.

## Responses

Successful run:

```json
{
  "runId": "health-check-run-id",
  "triggerType": "SCHEDULED",
  "status": "COMPLETED",
  "checked": 2,
  "healthy": 1,
  "degraded": 0,
  "down": 1,
  "skipped": 0,
  "errors": 0
}
```

Missing secret returns `401`. Invalid secret returns `403`. If the app is missing `INTERNAL_HEALTH_CHECK_SECRET`, the route returns `503`.

When another run is already active for the same workspace, the route returns `409` with a skipped summary. The active run owns the work; the skipped response must not be retried immediately in a tight loop.

## Retry Behavior

Use normal scheduler retry behavior for transient network or `5xx` failures. A `409` means a run is already active and should be allowed to finish. The next scheduled interval can try again safely. Runs are protected by a database-backed workspace lease that expires automatically, so a crashed worker can recover on a future attempt.

## n8n-Ready Setup

An importable n8n workflow template is available at:

```text
docs/n8n/production-readiness-scheduled-health-check.json
```

Detailed setup instructions are available at:

```text
docs/runbooks/n8n-scheduled-health-check-setup.md
```

The workflow can be configured later without changing application code:

1. Add a Schedule Trigger node for every 5 minutes.
2. Add an HTTP Request node.
3. Set the method to `POST`.
4. Set the URL to the deployed app endpoint ending in `/api/internal/health-checks/scheduled-run`.
5. Store `INTERNAL_HEALTH_CHECK_SECRET` in n8n credentials or protected n8n environment variables.
6. Configure the HTTP Request node to send the credential value as `x-internal-health-check-secret`.
7. Log non-`2xx` results for operator review.

This repository does not install, run, or connect n8n. The Overview page should only show scheduled-run evidence after a real scheduled request has succeeded.
