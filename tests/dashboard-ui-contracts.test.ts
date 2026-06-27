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
});
