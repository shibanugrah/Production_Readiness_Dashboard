# Operational Event Ingestion Runbook

Operational events are accepted through a workspace-scoped ingestion key. The app does not accept workspace ID, user ID, role, or source authority from the request body.

## Endpoint

```http
POST /api/internal/operational-events
Authorization: Bearer <one-time-created-ingestion-key>
```

The header `x-operational-event-ingest-key` is also supported for controlled integrations that cannot send bearer auth.

## Ingestion Key Lifecycle

Workspace Owners create event ingestion keys in Settings. A key is scoped to one workspace and one source. The full key is shown once immediately after creation:

```text
Copy this key now. It will not be shown again.
```

Only a lookup ID and hashed secret are stored. Plaintext key material is never stored and is not available in later read models. Revocation marks the key inactive and preserves evidence.

## Payload Contract

Required fields:

```json
{
  "type": "JOB",
  "severity": "ERROR",
  "idempotencyKey": "source-stable-event-id",
  "occurredAt": "2026-06-27T00:00:00.000Z"
}
```

Optional fields:

```json
{
  "serviceId": "service-id-from-this-workspace",
  "externalReference": "source/run/123",
  "errorMessage": "Short operator-safe message",
  "payload": {
    "jobId": "123",
    "attempt": 1
  }
}
```

The event source is derived from the ingestion key, not the request body. If `serviceId` is supplied, it must belong to the key's workspace.

## Idempotency

The unique idempotency scope is:

```text
workspaceId + source + idempotencyKey
```

Submitting the same accepted event again with the same idempotency key returns the original event with HTTP `200` and does not create a duplicate row. Reusing the idempotency key with materially different content returns HTTP `409`.

## Response Statuses

| Status | Meaning |
| --- | --- |
| `201` | New event accepted and persisted. |
| `200` | Safe idempotent replay; existing event returned. |
| `400` | Invalid JSON, unsafe payload, oversized payload, or field validation error. |
| `401` | Missing or malformed ingestion key. |
| `403` | Invalid, inactive, or revoked ingestion key. |
| `409` | Idempotency key collision with different event content. |

## Payload Safety Rules

The request body and nested `payload` are size-limited. Payload depth is limited. Sensitive field names are rejected, including:

```text
authorization
cookie
password
secret
token
apiKey
```

Error responses do not echo raw payloads or authorization values.

## Future Source Guidance

Payment Control Center, Notice Intelligence, n8n workflows, deployment jobs, and local demo scripts should each use a source-specific ingestion key. Each source should provide a stable idempotency key from its own event ID, job ID, notice ID, deployment ID, or workflow execution ID.

Do not share one key across unrelated systems. Revoke and rotate keys from Settings if a source is retired or a key may have been exposed.

## Local Verification Without Printing Keys

1. Sign in as Owner.
2. Create a key in Settings for a local demo source.
3. Copy the key into a temporary terminal variable.
4. Send a test request without echoing the variable value.
5. Confirm the event appears on Events and Overview.
6. Repeat the same request with the same idempotency key and confirm HTTP `200`.
7. Change the payload while keeping the idempotency key and confirm HTTP `409`.
8. Revoke the key and confirm future requests return `403`.
