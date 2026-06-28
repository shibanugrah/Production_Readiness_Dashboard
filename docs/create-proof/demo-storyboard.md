# Demo Storyboard - Production Readiness Dashboard

Target duration: 45-75 seconds. Record only after the approved capture state exists. Do not record login, credentials, browser chrome, terminals, source code, provider dashboards, or secret-bearing screens.

## Proposed 60-Second Sequence

| Time | Screen | Action | Message |
|---|---|---|---|
| 0-5s | Overview | Start already signed in on the approved demo workspace. | "A production-readiness dashboard for operators who need evidence, not vibes." |
| 5-14s | Overview | Point to Healthy deployed dashboard service, latest manual run, and scheduler Not configured. | "The cover state is honest: a real manual check proves service health, while scheduling is clearly not configured." |
| 14-24s | Overview | Click or show "Run manual checks" only if safe to mutate during recording. Let the persisted run summary update. | "Owner/Admin operators can run checks and get persisted run evidence." |
| 24-34s | Services | Navigate to Services and scan status, last checked, last healthy, latency, version. | "The dashboard reads from persisted service and health-check records, not static demo numbers." |
| 34-45s | Service detail | Open the deployed dashboard service detail. Show Healthy result, HTTP 200, latency, observed version, and history. | "Each service has check history, configuration context, and latest result details." |
| 45-54s | Secondary degraded proof | Show the approved latency-driven Degraded state if it exists; otherwise skip this shot. | "Failure handling is explicit: a slow but valid response becomes Degraded, not magically Healthy." |
| 54-64s | Viewer or Events | Preferred: switch to Viewer read-only state. Conditional: show safe Events triage if approved demo event exists. | "Role boundaries and operator workflows are built into the product, not left as slideware." |
| 64-72s | Readiness | Show unavailable integrations and honest scope boundaries. | "The app also names what is not connected yet: scheduling activation, deployment integrations, and enterprise auth stay out of the proof until built." |
| 72-75s | Overview or closing title card | Return to Overview or end on product name. | "Live demo available; proof pack maps every claim to implementation evidence." |

## Alternate 45-Second Cut

| Time | Screen | Action | Message |
|---|---|---|---|
| 0-6s | Overview | Show manual-check healthy state and scheduler Not configured. | "Real health evidence without overclaiming scheduling." |
| 6-18s | Services | Show persisted service rows. | "Service status and latency are backed by stored checks." |
| 18-31s | Service detail | Show Healthy latest result and history. | "The detail view explains what changed and why." |
| 31-39s | Viewer role | Show read-only/disabled controls. | "Viewer access is read-only, with server-side denial tested." |
| 39-45s | Readiness | Show unavailable integrations. | "Implemented scope is separate from roadmap." |

## Optional Event/Incident Branch

Use this branch only after actual safe demo evidence exists:

1. Events: show one persisted event row, linked service, triage controls, and safe payload preview.
2. Events: acknowledge or resolve the event only if the state change is intended for the demo.
3. Incidents: show one incident created from the event and its audit timeline.
4. Crop/blur idempotency keys, actor emails, internal IDs, source internals, and raw payload details.

## Recording Safety Checklist

- Use a clean browser profile or Playwright recording with an approved demo session.
- Hide password managers, bookmarks, browser chrome, notifications, and desktop taskbar.
- Start recording after sign-in.
- Do not record Settings key creation success screens or any full ingestion key.
- Do not record terminals, provider dashboards, source code, environment files, database URLs, or logs.
- Do not claim customers, revenue, uptime, production scale, active scheduler, paging, OAuth, SSO, MFA, or external integrations.
- If a Degraded proof shot is recorded, restore the final dashboard state to Healthy before recording the cover/closing pass.
