import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const workspaceRoot = path.resolve(__dirname, "..");
const workflowPath = path.join(
  workspaceRoot,
  "docs",
  "n8n",
  "production-readiness-scheduled-health-check.json",
);

function listFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const absolutePath = path.join(directory, entry);
    const stats = statSync(absolutePath);

    if (stats.isDirectory()) {
      return listFiles(absolutePath);
    }

    return absolutePath;
  });
}

describe("n8n scheduler workflow template", () => {
  it("is valid JSON with the scheduled health-check workflow structure", () => {
    const workflow = JSON.parse(readFileSync(workflowPath, "utf8")) as {
      nodes: Array<{ name: string; parameters?: Record<string, unknown> }>;
    };
    const nodeNames = workflow.nodes.map((node) => node.name);

    expect(nodeNames).toContain("Schedule Trigger - Every 5 Minutes");
    expect(nodeNames).toContain("POST Scheduled Health-Check Run");
    expect(nodeNames).toContain("Classify Scheduler Response");
    expect(nodeNames).toContain("409 Safe Overlap?");
    expect(JSON.stringify(workflow)).toContain(
      "/api/internal/health-checks/scheduled-run",
    );
    expect(JSON.stringify(workflow)).toContain(
      "x-internal-health-check-secret",
    );
  });

  it("uses placeholders or n8n environment expressions instead of hardcoded URLs or secrets", () => {
    const workflowText = readFileSync(workflowPath, "utf8");
    const workflow = JSON.parse(workflowText) as {
      nodes: Array<{ name: string; parameters?: Record<string, unknown> }>;
    };
    const httpNode = workflow.nodes.find(
      (node) => node.name === "POST Scheduled Health-Check Run",
    );

    expect(workflowText).not.toContain("localhost");
    expect(workflowText).not.toMatch(/https?:\/\/[A-Za-z0-9.-]+/);
    expect(workflowText).not.toContain("route-test-secret");
    expect(workflowText).not.toContain("test-health-secret");
    expect(JSON.stringify(httpNode?.parameters)).toContain(
      "$env.PRODUCTION_READINESS_DASHBOARD_BASE_URL",
    );
    expect(JSON.stringify(httpNode?.parameters)).toContain(
      "$env.PRODUCTION_READINESS_INTERNAL_HEALTH_CHECK_SECRET",
    );
  });

  it("does not pass the internal health-check secret into client components", () => {
    const clientFiles = listFiles(path.join(workspaceRoot, "src")).filter((file) => {
      if (!/\.(ts|tsx)$/.test(file)) {
        return false;
      }

      const source = readFileSync(file, "utf8");
      return source.startsWith('"use client"') || source.startsWith("'use client'");
    });

    for (const file of clientFiles) {
      expect(readFileSync(file, "utf8")).not.toContain(
        "INTERNAL_HEALTH_CHECK_SECRET",
      );
    }
  });
});
