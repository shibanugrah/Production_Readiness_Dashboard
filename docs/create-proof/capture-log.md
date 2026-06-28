# Capture Log - Production Readiness Dashboard

Capture run: 2026-06-28-live-capture
Captured at: 2026-06-28T13:09:26.907Z
Environment: live app only (https://production-readiness-dashboard.vercel.app)
Method: Playwright Chromium, clean signed-in demo contexts, app viewport screenshots only

## State Setup Notes
- Non-dashboard demo service was deactivated through the live UI in the prior capture attempt.
- Dashboard service was pointed at the public health endpoint with expected version v0.1.0.
- Fresh manual health checks completed through the live UI, but live server-observed latency remained above the 1500 ms Degraded threshold.
- Invalid Degraded Overview, Services, Service Detail, and full Viewer table screenshots were removed from the approved screenshot set.

## Captured Items

| Screenshot ID | Route | Capture method | Claim IDs | Privacy status | Crop / blur | Path |
|---|---|---|---|---|---|---|
| 04-readiness-scope-boundaries | /readiness | Playwright Chromium, clean headless context, app main viewport clip | E-20, E-21, C-11 | public-safe after crop; unavailable integrations shown as scope boundaries | Cropped to app main content viewport; browser chrome, topbar, sidebar, and user panel excluded. No blur applied. | docs/create-proof/screenshots/2026-06-28-live-capture/04-readiness-scope-boundaries.png |
| 05-viewer-readonly-actions | /services?q=Production%20Readiness%20Dashboard | Playwright Chromium, clean headless viewer context, app header/action viewport clip | E-15, C-08 | public-safe after tight crop; no service status, credentials, or email visible | Tight crop to page header/action area only; browser chrome, topbar, sidebar, user panel, service table, and Degraded status excluded. No blur applied. | docs/create-proof/screenshots/2026-06-28-live-capture/05-viewer-readonly-actions.png |

## Blocked Screenshots
- 01-overview-manual-healthy (/): Blocked because the fresh live manual check classified the deployed dashboard service Degraded due latency above the 1500 ms threshold; this did not satisfy the approved Healthy cover state.
- 02-services-list-public-safe (/services?q=Production%20Readiness%20Dashboard): Blocked because the public-safe services list showed the deployed dashboard service as Degraded, not Healthy.
- 03-service-detail-healthy (/services/[serviceId]): Blocked because service detail did not show Current status Healthy / Latest result Success after the fresh live manual check.

## Privacy Issues Requiring Review
- None detected in retained screenshots. Manual visual review is still required.