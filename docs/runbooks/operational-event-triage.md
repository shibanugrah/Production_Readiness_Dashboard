# Operational Event Triage Runbook

Operational events are immutable ingestion evidence. Triage adds operator state on top of that evidence without changing the original source, idempotency key, payload hash, service link, or occurrence timestamp.

## Event Lifecycle

Supported event statuses:

| Status | Meaning |
| --- | --- |
| `OPEN` | Newly ingested event that has not been handled. |
| `ACKNOWLEDGED` | An Owner or Admin has seen the event and accepted ownership of follow-up. |
| `RESOLVED` | An Owner or Admin has recorded an operator-authored resolution note. |

An acknowledged event can be resolved. A resolved event can be reopened only through an explicit reopen action with a short reason. Reopen history is retained in audit records.

## Acknowledge Versus Resolve

Acknowledge when the event is real and someone is actively investigating or monitoring it.

Resolve only when the operator has a concrete outcome to record. Resolution notes are length-limited, display-safe text. They should describe what changed or why no further action is needed.

## When To Create An Incident

Create an incident from an event when the event represents a real escalation that needs incident-level tracking. Incident creation links the incident to the source event and does not automatically acknowledge, resolve, or otherwise mutate that event.

Each event can create at most one linked incident. If an incident already exists, the Events page links to it instead of offering duplicate creation.

## Incident Lifecycle

Incidents are intentionally small:

| Status | Meaning |
| --- | --- |
| `OPEN` | The escalation is active. |
| `RESOLVED` | An Owner or Admin has recorded resolution notes. |

Owner assignment is not implemented yet. Incidents display as unassigned unless a future workflow adds assignment safely.

## Audit Behavior

The app writes audit entries for:

```text
OPERATIONAL_EVENT_ACKNOWLEDGED
OPERATIONAL_EVENT_RESOLVED
OPERATIONAL_EVENT_REOPENED
INCIDENT_CREATED
INCIDENT_RESOLVED
```

Audit metadata contains safe operator context such as event status changes, note length, incident severity, and linked service ID. It must not contain raw payloads, ingestion keys, authorization headers, secrets, or full error bodies.

Denied and failed validation attempts do not create audit records.

## Known Limitations

There is no automatic retry engine, dead-letter queue, notification workflow, paging policy, Slack/email integration, or third-party incident integration. Events and incidents are operator-managed evidence only.
