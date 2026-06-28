# Minimum Proof Asset List

Created on 2026-06-28 from existing approved screenshots and project proof notes only. No live capture, health check, sign-in, upload, publishing, or PDF generation was performed.

| Asset | Status | Source used | Claims supported | Privacy status |
|---|---|---|---|---|
| `01-overview-healthy.png` | Missing | No approved Healthy Overview screenshot was found in the proof folder or workspace root. Prior live capture blocked this state because the deployed service was Degraded due latency. Older overview screenshots are not public-safe because they show local/demo state, scheduled monitoring as active, or non-approved Degraded context. | Would support E-03, E-04, E-05, C-03, C-04 after approved capture. | Missing; do not fabricate. Blocks PDF assembly. |
| `02-service-evidence.png` | Missing | No existing public-safe Services or Healthy Service Detail screenshot was suitable. Older service/detail screenshots show local/internal URLs, active monitoring language, Degraded demo state, or email-like audit actors. | Would support persisted service/check evidence and Healthy detail proof after approved capture. | Missing; do not fabricate. Blocks PDF assembly. |
| `03-viewer-readonly.png` | Created | `docs/create-proof/screenshots/2026-06-28-live-capture/05-viewer-readonly-actions.png` | E-15, C-08: Viewer access is read-only and mutation actions are unavailable/denied. | Public-safe tight crop to app content. No browser chrome, taskbar, credentials, emails, keys, IDs, or internal URLs visible. No blur applied. |
| `04-readiness-boundaries.png` | Created | `docs/create-proof/screenshots/2026-06-28-live-capture/04-readiness-scope-boundaries.png` | E-20, E-21, C-11: Readiness page marks unavailable integrations and scope boundaries honestly. | Public-safe crop to app content. No browser chrome, taskbar, credentials, emails, keys, IDs, or internal URLs visible. No blur applied. |
| `architecture-diagram.mmd` | Created | Existing approved architecture boundary from proof request and prior evidence notes. | Public-safe high-level architecture only. | No secrets, endpoints, schemas, repository URLs, provider details, or internal IDs. |
| `demo-script-60-seconds.md` | Created | Existing demo storyboard and known project limitations. | Owner/Admin manual checks, persisted service/check evidence, Healthy/Degraded/Down classification, Viewer read-only access, scheduler not configured. | Public-safe script; recording must wait for missing approved screenshots/state. |
| `known-limitations.md` | Created | Existing evidence ledger, claim source map, README/runbook-derived limitations already captured in proof notes. | Scheduler not configured, Owner/Admin manual checks, no automated alerting/paging, external integrations future work. | Public-safe scope boundary. |

## Blockers

- A public-safe Healthy Overview screenshot is still required for the cover/proof opener.
- A public-safe Services or Healthy Service Detail screenshot is still required for persisted service/check evidence.

## Privacy Findings

- No privacy issues were found in the two copied approved live-capture assets.
- Rejected older screenshots contained non-approved local/demo state and, in some cases, local/container URLs, email-like audit actors, active monitoring language, or Degraded states unsuitable for this minimum proof pack.
