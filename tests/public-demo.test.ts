import { readFileSync } from "node:fs";
import path from "node:path";

import {
  HealthCheckRunStatus,
  HealthCheckRunTriggerType,
  HealthCheckStatus,
  ServiceEnvironment,
  ServiceStatus,
  WorkspaceRole,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  getPublicDemoAvailability,
} from "@/server/public-demo";
import {
  getPublicDemoSeedConfig,
  getPublicDemoSeedServices,
  publicDemoSelfMonitor,
  publicDemoWorkspace,
} from "@/server/public-demo-config";

const root = process.cwd();
const now = new Date("2026-06-28T12:00:00.000Z");
const publicDemoEnv = {
  NODE_ENV: "production",
  APP_VERSION: "2026.06.28-demo",
  PUBLIC_DEMO_ACCESS_ENABLED: "true",
  PUBLIC_DEMO_APP_BASE_URL: "https://readiness.example.invalid",
  PUBLIC_DEMO_VIEWER_EMAIL: "public-viewer@example.invalid",
} as NodeJS.ProcessEnv;

function service(overrides: Record<string, unknown> = {}) {
  return {
    id: "service_self_monitor",
    slug: publicDemoSelfMonitor.slug,
    name: publicDemoSelfMonitor.name,
    baseUrl: publicDemoEnv.PUBLIC_DEMO_APP_BASE_URL,
    healthPath: publicDemoSelfMonitor.healthPath,
    environment: ServiceEnvironment.PRODUCTION,
    expectedVersion: publicDemoEnv.APP_VERSION,
    status: ServiceStatus.HEALTHY,
    lastHealthyAt: now,
    ...overrides,
  };
}

function healthyManualCheck(overrides: Record<string, unknown> = {}) {
  return {
    status: HealthCheckStatus.SUCCESS,
    checkedAt: now,
    observedVersion: publicDemoEnv.APP_VERSION,
    run: {
      triggerType: HealthCheckRunTriggerType.MANUAL,
      status: HealthCheckRunStatus.COMPLETED,
    },
    ...overrides,
  };
}

function publicDemoClient({
  activeServices = [service()],
  latestCheck = healthyManualCheck(),
  viewerMemberships,
}: {
  activeServices?: Array<Record<string, unknown>>;
  latestCheck?: Record<string, unknown> | null;
  viewerMemberships?: Array<Record<string, unknown>>;
} = {}) {
  return {
    workspace: {
      findUnique: vi.fn(async () => ({
        id: "workspace_public",
        slug: publicDemoWorkspace.slug,
      })),
    },
    user: {
      findUnique: vi.fn(async () => ({
        id: "public_viewer",
        memberships:
          viewerMemberships ??
          [
            {
              role: WorkspaceRole.VIEWER,
              workspaceId: "workspace_public",
              workspace: { slug: publicDemoWorkspace.slug },
            },
          ],
      })),
    },
    service: {
      findMany: vi.fn(async () => activeServices),
    },
    healthCheck: {
      findFirst: vi.fn(async () => latestCheck),
    },
  };
}

describe("public demo access", () => {
  it("is disabled by default without waking the database", async () => {
    const client = publicDemoClient();

    await expect(
      getPublicDemoAvailability({
        client: client as never,
        environment: { ...publicDemoEnv, PUBLIC_DEMO_ACCESS_ENABLED: "false" } as NodeJS.ProcessEnv,
        now: () => now,
      }),
    ).resolves.toMatchObject({
      kind: "disabled",
    });
    expect(client.workspace.findUnique).not.toHaveBeenCalled();
    expect(client.healthCheck.findFirst).not.toHaveBeenCalled();
  });

  it("requires explicit server-side public demo configuration", async () => {
    await expect(
      getPublicDemoAvailability({
        client: publicDemoClient() as never,
        environment: {
          ...publicDemoEnv,
          PUBLIC_DEMO_APP_BASE_URL: "",
        } as NodeJS.ProcessEnv,
        now: () => now,
      }),
    ).resolves.toMatchObject({
      kind: "unavailable",
      message: "Public demo access is not fully configured on the server.",
    });
  });

  it("creates availability only for an isolated Viewer membership in the dedicated workspace", async () => {
    await expect(
      getPublicDemoAvailability({
        client: publicDemoClient({
          viewerMemberships: [
            {
              role: WorkspaceRole.ADMIN,
              workspaceId: "workspace_public",
              workspace: { slug: publicDemoWorkspace.slug },
            },
          ],
        }) as never,
        environment: publicDemoEnv,
        now: () => now,
      }),
    ).resolves.toMatchObject({ kind: "unavailable" });

    await expect(
      getPublicDemoAvailability({
        client: publicDemoClient({
          viewerMemberships: [
            {
              role: WorkspaceRole.VIEWER,
              workspaceId: "workspace_public",
              workspace: { slug: publicDemoWorkspace.slug },
            },
            {
              role: WorkspaceRole.VIEWER,
              workspaceId: "workspace_private",
              workspace: { slug: "portfolio-operations" },
            },
          ],
        }) as never,
        environment: publicDemoEnv,
        now: () => now,
      }),
    ).resolves.toMatchObject({ kind: "unavailable" });
  });

  it("refuses entry when no real recent Healthy manual check exists", async () => {
    await expect(
      getPublicDemoAvailability({
        client: publicDemoClient({ latestCheck: null }) as never,
        environment: publicDemoEnv,
        now: () => now,
      }),
    ).resolves.toMatchObject({ kind: "unavailable" });

    await expect(
      getPublicDemoAvailability({
        client: publicDemoClient({
          latestCheck: healthyManualCheck({
            run: {
              triggerType: HealthCheckRunTriggerType.SCHEDULED,
              status: HealthCheckRunStatus.COMPLETED,
            },
          }),
        }) as never,
        environment: publicDemoEnv,
        now: () => now,
      }),
    ).resolves.toMatchObject({ kind: "unavailable" });
  });

  it("allows entry after a real successful manual check enables the truthful Healthy state", async () => {
    await expect(
      getPublicDemoAvailability({
        client: publicDemoClient() as never,
        environment: publicDemoEnv,
        now: () => now,
      }),
    ).resolves.toMatchObject({
      kind: "available",
      viewerUserId: "public_viewer",
      workspaceSlug: publicDemoWorkspace.slug,
    });
  });

  it("ignores inactive failure demo services but blocks accidental extra active services", async () => {
    await expect(
      getPublicDemoAvailability({
        client: publicDemoClient({
          activeServices: [
            service(),
            service({
              id: "service_failure",
              slug: "active-failure-demo",
              name: "Active Failure Demo",
              status: ServiceStatus.DOWN,
            }),
          ],
        }) as never,
        environment: publicDemoEnv,
        now: () => now,
      }),
    ).resolves.toMatchObject({ kind: "unavailable" });

    const seedServices = getPublicDemoSeedServices({
      appBaseUrl: publicDemoEnv.PUBLIC_DEMO_APP_BASE_URL as string,
      appVersion: publicDemoEnv.APP_VERSION as string,
    });

    expect(seedServices).toEqual([
      expect.objectContaining({
        name: publicDemoSelfMonitor.name,
        slug: publicDemoSelfMonitor.slug,
        healthPath: "/api/health",
        isActive: true,
      }),
      expect.objectContaining({
        isActive: false,
      }),
    ]);
  });

  it("requires public demo seed config and never includes a Viewer password", () => {
    expect(getPublicDemoSeedConfig(publicDemoEnv)).toBeNull();

    const seedConfig = getPublicDemoSeedConfig({
      ...publicDemoEnv,
      PUBLIC_DEMO_OWNER_EMAIL: "public-owner@example.invalid",
      PUBLIC_DEMO_OWNER_PASSWORD: "owner-password",
    } as NodeJS.ProcessEnv);

    expect(seedConfig).toMatchObject({
      ownerEmail: "public-owner@example.invalid",
      viewerEmail: "public-viewer@example.invalid",
    });
    expect(seedConfig).not.toHaveProperty("viewerPassword");
  });

  it("does not seed fabricated health-check or run history", () => {
    const seedSource = readFileSync(path.join(root, "prisma", "seed.ts"), "utf8");

    expect(seedSource).not.toMatch(/healthCheck\s*\.\s*(create|upsert)/);
    expect(seedSource).not.toMatch(/healthCheckRun\s*\.\s*(create|upsert)/);
  });
});
