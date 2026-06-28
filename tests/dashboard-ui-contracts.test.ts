import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function source(filePath: string) {
  return readFileSync(path.join(root, filePath), "utf8");
}

describe("dashboard UI cleanup contracts", () => {
  it("does not render a static notification count in the shared shell", () => {
    const appShell = source("src/components/dashboard/app-shell.tsx");

    expect(appShell).not.toContain("bg-rose-500");
    expect(appShell).not.toContain("text-[10px]");
  });

  it("keeps manual health-check controls production-capable and role-aware", () => {
    const appShell = source("src/components/dashboard/app-shell.tsx");
    const authenticatedShell = source(
      "src/components/dashboard/authenticated-shell.tsx",
    );
    const controls = source("src/components/dashboard/local-actions.tsx");
    const overview = source("src/app/page.tsx");
    const serviceDetail = source("src/app/services/[serviceId]/page.tsx");
    const serviceConfig = source(
      "src/components/dashboard/service-configuration-controls.tsx",
    );

    expect(appShell).toContain("All environments");
    expect(appShell).not.toContain(">Local<");
    expect(authenticatedShell).toContain("canRunChecks={canRunChecks(context)}");
    expect(controls).toContain("Run manual checks");
    expect(controls).not.toContain("Run local checks");
    expect(`${serviceDetail}\n${serviceConfig}`).toContain("Monitoring enabled");
    expect(`${serviceDetail}\n${serviceConfig}`).not.toContain("Active monitoring");
    expect(overview).not.toContain("isLocalDemoActionsEnabled() && canRunChecks");
    expect(serviceDetail).not.toContain("isLocalDemoActionsEnabled() && canRunChecks");
  });

  it("keeps empty health-check history honest with a clear manual next action", () => {
    const overview = source("src/app/page.tsx");
    const serviceDetail = source("src/app/services/[serviceId]/page.tsx");

    expect(overview).toContain("No check cycles recorded");
    expect(overview).toContain(
      "Manual runs will appear here after an Owner or Admin runs manual checks.",
    );
    expect(serviceDetail).toContain(
      "Run manual checks to create persisted health-check history.",
    );
    expect(`${overview}\n${serviceDetail}`).not.toContain("runs local checks");
  });

  it("describes Settings by the workflows that are actually implemented", () => {
    const settingsPage = source("src/app/settings/page.tsx");

    expect(settingsPage).toContain(
      "Review scheduler evidence, event ingestion keys, and workspace audit activity.",
    );
    expect(settingsPage).not.toContain(
      "Workspace and operator settings are not connected yet.",
    );
  });

  it("shows revoked ingestion keys as a final state rather than an active revoke action", () => {
    const keyControls = source(
      "src/components/dashboard/event-ingest-key-controls.tsx",
    );

    expect(keyControls).toContain(
      'aria-label="Event ingestion key already revoked"',
    );
    expect(keyControls).toContain("Revoked");
  });

  it("keeps public demo entry credential-free and read-only scoped", () => {
    const signIn = source("src/app/signin/page.tsx");
    const authActions = source("src/server/auth/actions.ts");

    expect(signIn).toContain("Explore read-only demo");
    expect(signIn).toContain("Operators sign in with configured credentials.");
    expect(signIn).not.toContain("Use a seeded demo account");
    expect(signIn).not.toContain("viewer@example");
    expect(authActions).toContain("publicDemoSignInAction()");
    expect(authActions).not.toContain("formData.get(\"workspace");
    expect(authActions).not.toContain("formData.get(\"role");
  });

  it("states public demo limitations without claiming future integrations are active", () => {
    const signIn = source("src/app/signin/page.tsx");
    const readiness = source("src/app/readiness/page.tsx");
    const combined = `${signIn}\n${readiness}`;

    expect(combined).toContain(
      "Scheduled checks are intentionally not configured for this free public demo.",
    );
    expect(combined).toContain("Owner/Admin users can run manual health checks.");
    expect(combined).toContain(
      "Automated alerting, paging, and production notification delivery are not connected.",
    );
    expect(combined).toContain(
      "External integrations are future work and are not presented as active.",
    );
    expect(combined).not.toMatch(/n8n is active|paging is active|external integrations are active|production alerting is active/i);
  });
});
