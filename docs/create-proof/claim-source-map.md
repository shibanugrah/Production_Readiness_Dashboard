# Claim Source Map - Production Readiness Dashboard

This file maps public proof claims to implementation evidence and planned proof assets. It also contains the PDF outline, portfolio case-study draft, and README proof-section plan requested for the capture plan.

Status legend: `implemented`, `needs_verification`, `roadmap`, `private_do_not_publish`.

## Proposed Proof Narrative

Production Readiness Dashboard should be positioned as a trustworthy full-stack SaaS workflow for operational evidence. The proof should lead with a real deployed health check and an honest scheduler boundary, then show the operator journey: persisted services, manual checks, service detail/history, permission boundaries, and explicit unavailable integrations. The narrative should avoid production-scale claims and instead emphasize implementation discipline: real backend logic, database-backed state, tested RBAC, safe health classification, and clear roadmap separation.

## 6-8 Page LinkedIn Featured PDF Outline

| Page | Message | Evidence to use | Status |
|---|---|---|---|
| 1. Cover | "Production Readiness Dashboard: operational evidence for full-stack SaaS workflows." | S-01 Overview after healthy manual check and scheduler Not configured | needs_verification |
| 2. Problem | Operators need trustworthy readiness evidence, not static status cards or inflated claims. | README route/evidence statements; Readiness unavailable states | implemented |
| 3. Operator workflow | Owner/Admin runs manual checks and reviews persisted service status. | S-01 Overview, S-02 Services | needs_verification |
| 4. Health-check evidence and classification | Healthy evidence is the steady state; degraded latency is a secondary failure-handling proof. | S-03 Healthy detail; S-04 Degraded latency secondary; classifier tests | needs_verification |
| 5. Permissions and trustworthy state handling | Viewer is read-only; mutation paths are denied server-side; Unknown stays Unknown without checks. | S-08 Viewer; RBAC/read-model tests | needs_verification |
| 6. Engineering/reliability decisions | Persisted runs, safe health endpoint, target validation, workspace scoping, idempotent event ingestion. | Source/tests/runbooks; optional S-05 Events | implemented |
| 7. Implemented scope vs roadmap | Scheduler-ready but not active by default; deployment integrations and enterprise auth are not connected. | S-07 Readiness; README/runbooks | implemented |
| 8. Closing / live-demo CTA | "Live demo and claim-source map available; every public claim is evidence-backed." | Live demo URL; no secrets or repo URLs | needs_verification |

If the final PDF must be 6 pages, combine pages 2 and 3, and combine pages 7 and 8.

## Claim Source Table

| Claim ID | Public claim | Status | Primary evidence | Planned visual proof | Public wording guardrail |
|---|---|---|---|---|---|
| C-01 | Live demo has a safe self-health endpoint with database connected. | implemented | Live `/api/health` check on 2026-06-28; `src/server/health.ts`; `tests/health.test.ts` | Optional small callout, not a full screenshot | Say "verified during manual public check"; do not claim uptime. |
| C-02 | Dashboard access is authenticated and workspace-scoped. | implemented | `src/components/dashboard/authenticated-shell.tsx`; `src/server/auth/context.ts`; auth tests | Avoid login screenshot unless needed | Do not show credentials or personal emails. |
| C-03 | Owner/Admin manual checks create persisted run evidence. | implemented | `src/server/dashboard/actions.ts`; `src/server/health-checks/runner.ts`; runner/RBAC tests | S-01 Overview | Use only after fresh manual run capture. |
| C-04 | Cover state: deployed dashboard service is Healthy after a manual check and scheduler is Not configured. | needs_verification | Implementation supports it; current signed-in live state not verified | S-01, S-03 | Must be confirmed in live/demo state before public use. |
| C-05 | Service statuses, latency, versions, and histories come from persisted records. | implemented | `src/server/dashboard/read-models.ts`; service pages; read-model tests | S-02, S-03 | Avoid local URLs and emails. |
| C-06 | Slow valid health responses become Degraded when latency exceeds 1500 ms. | implemented | `src/server/health-checks/classification.ts`; classification/demo-service tests | S-04 | Secondary proof only. Needs approved screenshot before public use. |
| C-07 | Invalid payloads, HTTP failures, redirects, and network errors are recorded safely. | implemented | execution/classification/runner tests | Optional detail/callout | Keep high-level; do not show logs or stack traces. |
| C-08 | Viewer role is read-only and mutations are denied server-side. | implemented | permissions, UI controls, RBAC/service/triage tests | S-08 | Use demo Viewer state; hide emails. |
| C-09 | Operational events are authenticated, workspace-scoped, idempotent, and triageable. | implemented | event ingestion/triage code, runbooks, tests | S-05 conditional | Do not show keys, auth headers, idempotency keys, or raw sensitive payloads. |
| C-10 | Incidents can be manually created from real events and resolved with audit evidence. | implemented | triage runbook/code/tests | S-06 conditional | Capture only after actual safe demo incident exists. |
| C-11 | Readiness page explicitly marks deployment evidence and integrations as unavailable. | implemented | `src/app/readiness/page.tsx`; README; UI contract tests | S-07 | Use as honest scope boundary. |
| C-12 | n8n scheduler is active. | roadmap | README/runbooks say not configured by default | None | Do not claim unless separate approved scheduled-run evidence exists. |
| C-13 | Automated alerting, paging, notifications, retries, dead-letter queues, remediation, and third-party incident tools are live. | roadmap | README/runbooks list as not built | None | Mention only as roadmap or omitted. |
| C-14 | OAuth, SSO, MFA, invitations, password reset, and billing are implemented. | roadmap | README/settings/readiness scope | None | Omit or place in roadmap boundary. |
| C-15 | External Payment Control Center or Notice Intelligence integrations are connected. | roadmap | README/runbooks | None | Omit as implemented claim. |
| C-16 | Customers, revenue, uptime, scale, production-scale, or security certification claims. | roadmap | No evidence found | None | Do not publish. |
| C-17 | Secrets, emails, internal endpoints, source code, provider dashboards, terminals, raw keys, IDs, and browser chrome. | private_do_not_publish | User instruction and screenshot review | None | Must be cropped, blurred, or omitted. |

## Portfolio Case-Study Draft

### Working title

Production Readiness Dashboard - trustworthy operational evidence for SaaS workflows.

### One-paragraph draft

I built Production Readiness Dashboard as a full-stack operational control plane for evidence-backed service readiness. The app focuses on real backend behavior: authenticated workspace access, Owner/Admin/Viewer permissions, service registry records, manual health-check runs, persisted run history, safe health classification, and explicit unavailable integration states. The public proof should show the deployed dashboard service in a Healthy manual-check state while clearly separating secondary failure-handling evidence and future roadmap items like scheduler activation, paging, enterprise auth, and external integrations.

### Case-study sections

1. Context: why operational dashboards need evidence-backed state.
2. What shipped: protected dashboard routes, service registry, manual checks, persisted history, event ingestion/triage, incidents, readiness boundaries.
3. Workflow: Owner/Admin manual check to Overview, Services, Service detail, and Viewer read-only proof.
4. Reliability choices: safe `/api/health`, health classification, target validation, persisted run summaries, workspace scoping, idempotency.
5. Permission boundaries: Owner/Admin actions and Viewer denial, with tests.
6. Evidence and limitations: live health check verified, signed-in screenshots pending, scheduler/integrations/enterprise auth as roadmap.
7. Role fit: AI-native product engineer with full-stack implementation, product judgment, and public-safe proof discipline.

## README Proof-Section Plan

Add a concise "Proof and Public Demo" section only after screenshots and the PDF are approved.

Suggested structure:

1. Live demo link: public app URL and `/api/health` verification note.
2. What the demo proves: manual health-check evidence, persisted service state, service detail/history, Viewer read-only boundaries, explicit unavailable integrations.
3. What it does not claim: active scheduler, external integrations, paging, OAuth/SSO/MFA, customers, revenue, uptime, scale.
4. Public proof artifacts: LinkedIn Featured PDF path, case-study link/path, demo video link/path after created.
5. Safety note: no secrets, provider dashboards, terminals, private repo URLs, raw ingestion keys, or personal data are included.

Do not add this README section until the user approves final proof artifacts.

## Claims Requiring User Approval Before Public Use

- The signed-in live cover state: deployed dashboard service Healthy after manual check and scheduler Not configured.
- Any use of a demo account/session for screenshots or video.
- Any failure-handling screenshot that creates a latency-driven Degraded state.
- Any event or incident demo record shown publicly.
- Any visible names, service names, timestamps, payload snippets, IDs, source labels, or audit actor labels.
- Any final LinkedIn PDF title, description, upload metadata, or destination.
