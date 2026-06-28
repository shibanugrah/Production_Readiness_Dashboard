# Screenshot Plan - Production Readiness Dashboard

No screenshots should be captured in this step. This is the approved-state checklist for a later capture pass.

## Capture Boundary

- Environment: public live demo at `https://production-readiness-dashboard.vercel.app/`.
- Auth: protected dashboard routes require user-approved demo sign-in.
- Recommended method: clean browser profile or Playwright storage state created after user-controlled demo sign-in.
- Do not store, print, paste, or screenshot credentials.
- Crop to the app viewport only. Do not include browser chrome, bookmarks, notifications, desktop taskbar, terminal, DevTools, provider dashboards, or source code.
- Use desktop viewport first. Capture mobile only if needed for the portfolio case study, not for the LinkedIn PDF core.

## Required Pre-Capture Product State

1. Confirm the public health endpoint is still HTTP 200 with safe JSON.
2. Sign in with an approved demo Owner or Admin account.
3. Ensure scheduler evidence is "Not configured - no scheduled run evidence yet." If the workspace contains persisted `SCHEDULED` runs, use a clean workspace/demo database or remove that state through an approved product-safe cleanup path.
4. Run a real manual health-check cycle from the dashboard.
5. Confirm the deployed dashboard service is Healthy, with HTTP 200, observed version, latency, and persisted history.
6. If capturing failure handling, create or select an approved service that returns valid HTTP 200 health JSON with matching version and latency above 1500 ms, capture it as secondary evidence, then restore the steady Healthy state.
7. Use public-safe service/event names. Avoid local/container URLs, demo emails, generated IDs, internal endpoints, and raw keys.

## Screenshot Candidates

| ID | Route/state | Status | Safe to capture after setup? | Purpose | Crop / blur / repeat flags |
|---|---|---|---|---|---|
| S-01 | Overview - healthy manual-check evidence; scheduler Not configured | needs_verification | Yes, after approved sign-in and fresh manual check | Cover and main operational proof. Shows that the deployed dashboard service is Healthy and that scheduler is not being overclaimed. | Repeat required. Crop app viewport. Blur/crop user panel if any email appears. Must not show scheduler Active. |
| S-02 | Services - persisted service list | needs_verification | Yes, after S-01 setup | Shows real persisted service status, last check, last healthy, latest latency, and service rows. | Repeat required. Crop/blur local/container URLs, generated IDs, or private service URLs. |
| S-03 | Service detail - Healthy deployed dashboard service | needs_verification | Yes, after S-01 setup | Shows Healthy result, latency, version, persisted history, latest check details, and configuration summary. | Repeat required. Crop out audit table or blur actor emails. Avoid source code, internal URLs, and private endpoints. |
| S-04 | Service detail - latency-driven Degraded result | needs_verification | Conditional | Secondary failure-handling proof: valid HTTP 200/version but latency above threshold classified Degraded. | Repeat required. Capture only after approved safe slow endpoint exists. Label secondary. Restore Healthy state before cover capture. |
| S-05 | Events - persisted event and triage controls | needs_verification | Conditional | Shows real safe operational-event workflow and Owner/Admin triage controls. | Capture only if actual demo evidence exists. Blur/crop idempotency keys, lookup IDs, source internals, local labels, payloads, and any sensitive metadata. |
| S-06 | Incidents - incident timeline from event | needs_verification | Conditional | Shows manual incident escalation and timeline evidence from a real event. | Capture only if actual incident demo evidence exists. Current inspected screenshots are empty. Blur actor emails and internal IDs. |
| S-07 | Readiness - unavailable integrations | implemented | Yes, after approved sign-in | Shows evidence-based state and explicit unavailable deployment integrations. | Crop app viewport. Use as honest scope boundary. No blur expected unless user panel exposes email. |
| S-08 | Viewer role - read-only controls | needs_verification | Yes, with approved viewer demo session | Shows read-only UI and disabled/denied mutation boundary without credentials. | Repeat required. Crop app viewport. Crop/blur user panel if email appears. Use tests for server-side denial proof. |

## Screens That Must Not Be Captured

- `.env`, `.env.local`, `.env.production.example` with real values, secret stores, database connection strings, API keys, cookies, password fields after typing, or clipboard contents.
- Neon, Vercel, cloud provider, n8n credential dashboards, terminals, logs, DevTools, network inspectors, source code, repository remotes, or private repository pages.
- Internal scheduled-run or ingestion endpoints, scheduler secret configuration, raw authorization headers, event ingestion key creation success screens, raw full ingestion keys, lookup IDs, and full idempotency keys.
- Existing local screenshots that show scheduler Active, local/container URLs, notification badges, demo account emails, or degraded/version-mismatch states as if they were the cover state.
- Screens implying active scheduled monitoring, external integrations, automated paging, customers, revenue, uptime, scale, OAuth/SSO/MFA, or production certification.

## Existing Screenshot Review

- `output/playwright/final/overview.png`: Do not reuse. It shows Scheduled monitoring Active, not the required Not configured cover state.
- `output/playwright/final/services.png`: Planning reference only. It shows local/container URLs and a degraded demo service state.
- `output/playwright/final/service-detail.png`: Planning reference only. It shows Degraded due version mismatch, local/container URL, and email-like audit rows.
- `output/playwright/final/events.png`: Planning reference only. It shows a real-looking demo event but exposes a full idempotency key and local source labels.
- `output/playwright/final/incidents.png`: Not useful for incident proof. It shows no incident records.
- `output/playwright/final/readiness.png`: Candidate state is conceptually safe, but repeat capture in the approved live/demo state is still required.
- `output/playwright/states/viewer-services-readonly.png`: Good planning reference for Viewer read-only UI, but repeat capture is required.

## Product-State Cleanup Before Capture

- Use a clean workspace state with no persisted scheduled-run evidence if the PDF needs the scheduler Not configured proof.
- Run the final manual healthy check last, so the cover and service detail pages do not show stale failure handling as the current state.
- Remove or avoid demo services with version-mismatch Degraded states unless they are intentionally used as secondary evidence.
- Use service names that are public-safe and not tied to private repos, internal systems, or one-off generated labels.
- For Events, use a safe generic event message and payload; keep idempotency and source internals hidden.
- For Incidents, create a demo incident only from a real safe event, then capture the linked source event and timeline without actor emails.
- Use Owner/Admin only for operator-action captures and Viewer only for read-only captures.
