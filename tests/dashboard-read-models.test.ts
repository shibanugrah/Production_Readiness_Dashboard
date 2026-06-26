import { ServiceStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  calculateReadinessState,
  calculateStatusCounts,
  getDisplayServiceStatus,
  getServiceDetailReadModel,
  ServiceWithLatestCheck,
} from "@/server/dashboard/read-models";
import { prisma } from "@/server/db";
import { getCurrentWorkspaceContext } from "@/server/auth/context";

vi.mock("@/server/db", () => ({
  prisma: {
    workspace: {
      findUnique: vi.fn(),
    },
    service: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/server/auth/context", () => ({
  getCurrentWorkspaceContext: vi.fn(),
}));

function serviceFixture(
  status: ServiceStatus,
  hasCheck = true,
  isActive = true,
): Pick<ServiceWithLatestCheck, "isActive" | "status" | "healthChecks"> {
  return {
    isActive,
    status,
    healthChecks: hasCheck
      ? [
          {
            id: "check_1",
            status: "SUCCESS",
            httpStatus: 200,
            responseTimeMs: 12,
            observedVersion: "local",
            migrationVersion: null,
            message: null,
            checkedAt: new Date("2026-06-26T00:00:00.000Z"),
          },
        ]
      : [],
  };
}

describe("dashboard read model calculations", () => {
  it("calculates readiness from active persisted service evidence", () => {
    expect(
      calculateReadinessState(
        calculateStatusCounts([
          serviceFixture(ServiceStatus.HEALTHY),
          serviceFixture(ServiceStatus.HEALTHY),
        ]),
      ),
    ).toBe("Ready");

    expect(
      calculateReadinessState(
        calculateStatusCounts([
          serviceFixture(ServiceStatus.HEALTHY),
          serviceFixture(ServiceStatus.DEGRADED),
        ]),
      ),
    ).toBe("Needs Attention");

    expect(
      calculateReadinessState(
        calculateStatusCounts([
          serviceFixture(ServiceStatus.HEALTHY),
          serviceFixture(ServiceStatus.DOWN),
        ]),
      ),
    ).toBe("Blocked");
  });

  it("shows services with no checks as Unknown even if their persisted status is healthy", () => {
    expect(getDisplayServiceStatus(serviceFixture(ServiceStatus.HEALTHY, false))).toBe(
      ServiceStatus.UNKNOWN,
    );
  });

  it("excludes inactive services from active overview counts", () => {
    expect(
      calculateStatusCounts([
        serviceFixture(ServiceStatus.HEALTHY, true, true),
        serviceFixture(ServiceStatus.DOWN, true, false),
      ]),
    ).toEqual({
      HEALTHY: 1,
      DEGRADED: 0,
      DOWN: 0,
      UNKNOWN: 0,
    });
  });

  it("returns null for a missing service in the authenticated workspace", async () => {
    vi.mocked(getCurrentWorkspaceContext).mockResolvedValue({
      workspaceId: "workspace_1",
      userId: "user_1",
      user: {
        id: "user_1",
        name: "Demo Owner",
        email: "owner@example.local",
      },
      workspace: {
        id: "workspace_1",
        name: "Portfolio Operations",
        slug: "portfolio-operations",
      },
      role: "OWNER",
    });
    vi.mocked(prisma.service.findFirst).mockResolvedValue(null);

    await expect(getServiceDetailReadModel("missing")).resolves.toBeNull();
    expect(prisma.service.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "missing",
          workspaceId: "workspace_1",
        },
      }),
    );
  });

  it("does not let browser-provided workspace IDs alter service list scoping", async () => {
    vi.mocked(getCurrentWorkspaceContext).mockResolvedValue({
      workspaceId: "workspace_a",
      userId: "user_1",
      user: {
        id: "user_1",
        name: "Demo Owner",
        email: "owner@example.local",
      },
      workspace: {
        id: "workspace_a",
        name: "Workspace A",
        slug: "workspace-a",
      },
      role: "OWNER",
    });
    vi.mocked(prisma.service.findMany).mockResolvedValue([]);

    const { getServiceListReadModel } = await import("@/server/dashboard/read-models");
    await getServiceListReadModel({
      query: "",
      workspaceId: "workspace_b",
    } as unknown as Parameters<typeof getServiceListReadModel>[0]);

    expect(prisma.service.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId: "workspace_a" },
      }),
    );
  });
});
