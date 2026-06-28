# Evidence Ledger - Production Readiness Dashboard

Status legend: `implemented`, `needs_verification`, `roadmap`, `private_do_not_publish`.

This ledger is for capture planning only. It does not authorize screenshots, PDF generation, upload, or publishing.

## Public Claim Ledger

| ID | Feature / possible public claim | Status | Evidence source | Public-safe wording | Include? | Notes / redactions |
|---|---|---|---|---|---|---|
| E-01 | A deployed self-health endpoint reports the app is configured and PostgreSQL is reachable. | implemented | Live check `LIVE-HEALTH-2026-06-28`; `README.md`; `src/app/api/health/route.ts`; `src/server/health.ts`; `tests/health.test.ts` | "The live demo exposes a safe health endpoint that returned HTTP 200 with database connected during manual verification." | yes | Do not turn manual network timing into a performance claim. |
| E-02 | Dashboard routes are protected behind sign-in and workspace access. | implemented | Live unauthenticated route checks; `src/components/dashboard/authenticated-shell.tsx`; `src/server/auth/context.ts`; `tests/authenticated-shell.test.ts`; `tests/auth-context.test.ts` | "Protected dashboard routes resolve workspace access from an authenticated database-backed session." | yes | Do not show credentials, cookies, or private user email addresses. |
| E-03 | Owner/Admin users can run manual health checks from the dashboard. | implemented | `README.md`; `docs/runbooks/production-deployment.md`; `src/server/dashboard/actions.ts`; `src/server/health-checks/runner.ts`; `tests/dashboard-rbac-actions.test.ts`; `tests/health-check-runner.test.ts` | "Owner/Admin operators can trigger manual health checks that create persisted run evidence." | yes, after fresh capture | Public screenshot must show a real manual run in the approved demo workspace. |
| E-04 | The cover proof state is the deployed dashboard service Healthy after a real manual check. | needs_verification | Code/tests support it; live signed-in state not inspected; existing local screenshots conflict with desired state | "Healthy deployed service after manual check." | yes, only after approval and repeat capture | Needs fresh signed-in capture. Existing screenshots show scheduler Active and local/container details, so do not reuse them. |
| E-05 | Scheduler status is evidence-based and should show Not configured when no scheduled run exists. | implemented | `README.md`; `docs/runbooks/production-deployment.md`; `docs/runbooks/health-check-scheduler.md`; `src/server/dashboard/read-models.ts`; `tests/dashboard-read-models.test.ts` | "The dashboard does not claim scheduled monitoring until a persisted scheduled run exists." | yes | Capture only if Overview shows "Not configured - no scheduled run evidence yet." |
| E-06 | Scheduled monitoring is active in the current public demo. | needs_verification | Not verified in signed-in live state; old local screenshot shows Active but conflicts with requested proof state | Do not claim as active. | no | Treat as not approved for public proof. If any scheduled run exists in production demo DB, clean/reset the demo state or choose a different workspace before capture. |
| E-07 | n8n scheduler activation is complete. | roadmap | README and runbooks state n8n is not configured by default | "Scheduler-ready; activation is future/optional setup." | no | Do not claim scheduled monitoring is active unless persisted scheduled-run evidence is intentionally captured and approved. |
| E-08 | Service list and detail pages show persisted service status, last check, latency, version, and history. | implemented | `README.md`; `src/app/services/page.tsx`; `src/app/services/[serviceId]/page.tsx`; `src/server/dashboard/read-models.ts`; `tests/dashboard-read-models.test.ts` | "Service status, latency, version, and history are rendered from persisted health-check records." | yes | Fresh screenshots must avoid internal/local URLs and emails. |
| E-09 | Services with no checks are shown as Unknown rather than treated as healthy. | implemented | `README.md`; `src/server/dashboard/read-models.ts`; `tests/dashboard-read-models.test.ts` | "Unknown services stay Unknown until check evidence exists." | optional | Useful for trustworthy-state handling page. |
| E-10 | A valid fast HTTP 2xx health response is classified Healthy. | implemented | `src/server/health-checks/classification.ts`; `tests/health-check-classification.test.ts`; `tests/demo-service-health.test.ts` | "Valid health responses classify as Healthy when they match version and latency expectations." | yes | Screenshot still needs fresh persisted evidence. |
| E-11 | A valid HTTP 200 response with latency above 1500 ms is classified Degraded. | implemented | `src/server/health-checks/classification.ts`; `tests/health-check-classification.test.ts`; `tests/demo-service-health.test.ts` | "Slow but valid health responses are degraded rather than treated as fully healthy." | yes, secondary only | Needs a fresh approved screenshot of the exact latency-driven state before public use. |
| E-12 | Failure-handling evidence should be the cover state. | private_do_not_publish | User instruction and proof positioning | Do not use degraded state as the cover. | no | Keep degraded latency proof as a secondary page or callout only. |
| E-13 | Invalid payloads, HTTP failures, redirects, timeouts, and network failures are handled safely. | implemented | `src/server/health-checks/execution.ts`; `src/server/health-checks/classification.ts`; `tests/health-check-execution.test.ts`; `tests/health-check-classification.test.ts`; `tests/health-check-runner.test.ts` | "The runner records safe failure evidence instead of exposing raw internals." | optional | Avoid raw errors, stack traces, URLs, or logs in screenshots. |
| E-14 | Health-check targets reject unsafe schemes, credentials, localhost/private networks, metadata addresses, and unsafe DNS in production paths. | implemented | `src/server/health-checks/target-safety.ts`; `tests/health-check-target-safety.test.ts`; `tests/service-management.test.ts` | "Health-check target validation avoids unsafe network targets in production paths." | optional | Keep wording high-level; do not publish detailed bypass mechanics. |
| E-15 | Viewer role is read-only and server-side mutation attempts are denied. | implemented | `src/server/auth/permissions.ts`; `src/components/dashboard/local-actions.tsx`; `src/components/dashboard/service-configuration-controls.tsx`; `tests/dashboard-rbac-actions.test.ts`; `tests/service-management.test.ts`; `tests/operational-event-triage.test.ts` | "Viewer access is read-only, with mutation denial enforced server-side." | yes | Fresh viewer screenshot must not show credentials or email addresses. |
| E-16 | Owner/Admin can acknowledge, resolve, reopen operational events, and create incidents from events. | implemented | `README.md`; `docs/runbooks/operational-event-triage.md`; `src/server/operational-events/triage.ts`; `tests/operational-event-triage.test.ts` | "Operators can triage persisted operational events and escalate one linked incident." | conditional | Capture only with actual safe demo evidence. Do not fabricate incidents. |
| E-17 | Operational events are ingested through workspace-scoped authenticated keys with idempotency. | implemented | `README.md`; `docs/runbooks/operational-event-ingestion.md`; `src/server/operational-events/ingestion.ts`; `src/server/operational-events/ingest-keys.ts`; `tests/operational-event-ingestion.test.ts`; `tests/operational-event-route.test.ts` | "Authenticated source events are persisted with workspace scope and idempotency." | conditional | Never show full ingestion keys, lookup IDs, auth headers, or full idempotency keys. |
| E-18 | Existing event screenshot has safe public evidence ready to publish. | needs_verification | Existing `output/playwright/final/events.png` inspected | Do not publish as-is. | no | It exposes full idempotency key and local source labels; repeat capture or crop/blur. |
| E-19 | Incident timeline screenshot is currently available. | needs_verification | Existing final and incident-detail screenshots inspected | Do not claim incident timeline yet. | no | Current inspected incident screenshots are empty. Include only after actual incident demo evidence exists. |
| E-20 | Readiness page honestly marks deployment integrations, release history, and readiness scoring as not connected. | implemented | `src/app/readiness/page.tsx`; `README.md`; `tests/dashboard-ui-contracts.test.ts` | "Unavailable integrations are shown explicitly instead of implied." | yes | Use as scope-boundary evidence. |
| E-21 | Deployment runbook and deploy-check script define provider-neutral release checks. | implemented | `docs/runbooks/production-deployment.md`; `scripts/deploy-check.ts`; `tests/deployment-readiness.test.ts`; `tests/package-scripts.test.ts` | "The repo includes a provider-neutral deployment runbook and non-mutating deployment checks." | yes | Do not show cloud provider dashboards or secret stores. |
| E-22 | Credentials-based demo authentication is enterprise OAuth/SSO/MFA. | roadmap | `README.md`; Settings/Readiness copy; tests | "Credentials demo auth exists; OAuth, SSO, MFA, and password reset are not built yet." | no | Do not overclaim identity features. |
| E-23 | Automated alerting, paging, notification rules, retry engines, dead-letter queues, automatic remediation, and third-party incident integrations are implemented. | roadmap | `README.md`; `docs/runbooks/operational-event-triage.md`; `src/app/readiness/page.tsx` | "These are future integrations, not current capabilities." | no | Keep out of public proof except roadmap boundary. |
| E-24 | External Payment Control Center or Notice Intelligence integrations are live. | roadmap | `README.md`; `docs/runbooks/operational-event-ingestion.md` | "External integration sources are future/source-specific setup." | no | Do not imply connected external products. |
| E-25 | Uptime, customer, revenue, usage scale, production-scale, or security certification metrics. | roadmap | No implementation/evidence found | Do not claim. | no | Fabricated metrics are forbidden. |
| E-26 | Emails, passwords, environment variables, database URLs, API keys, scheduler secrets, raw ingestion keys, provider dashboards, terminals, browser chrome, bookmarks, notifications, private repository URLs, source code, and internal endpoints. | private_do_not_publish | User instruction; proof safety rules; existing screenshot review | Do not include in public proof. | no | Crop, blur, or avoid. Existing screenshots include email-like demo addresses and local/container URLs. |

## Two Proof States

### Steady state - cover proof

- Status: `needs_verification`
- Required evidence: Signed-in deployed dashboard state after a real Owner/Admin manual check, with the deployed dashboard service Healthy and scheduler evidence clearly "Not configured - no scheduled run evidence yet."
- Current evidence: Public `/api/health` is Healthy with database connected. The protected dashboard state was not inspected because no approved sign-in state was available.
- Do not use: Existing local screenshots showing Scheduled monitoring Active or degraded/version-mismatch service state.

### Failure-handling evidence - secondary proof

- Status: `needs_verification` for screenshot; `implemented` for underlying classifier behavior.
- Required evidence: A persisted check where HTTP 200 and a valid health payload/version are present, latency exceeds 1500 ms, and the result is Degraded because of latency.
- Public placement: Secondary page/callout only.
- Cleanup: Restore the demo state to Healthy after capture so the cover state remains steady/healthy.

## Implemented Evidence Only

- Live `/api/health` returned safe HTTP 200 health JSON with `database: connected` and `version: v0.1.0` on 2026-06-28.
- Dashboard route protection, database-backed session lookup, and workspace membership resolution are implemented and tested.
- Manual health-check runs, persisted run summaries, service status updates, and service history are implemented and tested.
- Health classification handles Healthy, Degraded, and Down/Failure paths, including slow valid responses.
- Viewer read-only boundaries are implemented in UI state and server-side mutation paths.
- Operational event ingestion, event triage, incident creation/resolution, and audit evidence are implemented and tested.
- Readiness page explicitly marks unavailable release/deployment integrations.
- Deployment runbook and non-mutating deployment checks exist.

## Needs Verification

- Fresh signed-in live screenshots of Overview, Services, Service detail, Events, Incidents, and Viewer role states.
- The cover state: deployed dashboard service Healthy after a manual check and scheduler Not configured.
- A public-safe latency-driven Degraded screenshot.
- Actual safe event/incident demo records for Events and Incidents pages.
- Whether any existing scheduled-run rows in the public demo database must be removed or isolated before capture.

## Roadmap - Never Present As Complete

- n8n scheduler activation and scheduled monitoring as an active production capability.
- Automated alerting, paging, notification rules, retry engines, dead-letter queues, automatic remediation, owner assignment, and third-party incident integrations.
- External Payment Control Center or Notice Intelligence integrations.
- OAuth, SSO, MFA, invitations, password reset, billing, and enterprise identity workflows.
- Release history, deployment actors, approvals, readiness scoring, and external deployment integration.
- Customers, revenue, uptime, production scale, certifications, or usage metrics.

## Private Do Not Publish

- Passwords, credentials, demo account emails, cookies, API keys, event ingestion keys, scheduler secrets, environment variables, and database URLs.
- Neon/Vercel/provider dashboards, terminal output, logs, DevTools, source code, private repository URLs, and internal endpoint paths.
- Browser chrome, bookmarks, notifications, desktop taskbar, unrelated apps, and personal account state.
- Full idempotency keys, lookup IDs, source tokens, raw payloads with sensitive data, raw authorization headers, and exact internal implementation details.
