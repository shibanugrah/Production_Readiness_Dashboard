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

vi.mock("@/server/db", () => ({
  prisma: {
    workspace: {
      findUnique: vi.fn(),
    },
    service: {
      findFirst: vi.fn(),
    },
  },
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

  it("returns null for a missing service in the trusted workspace", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue({
      id: "workspace_1",
      name: "Portfolio Operations",
      slug: "portfolio-operations",
      createdAt: new Date("2026-06-26T00:00:00.000Z"),
      updatedAt: new Date("2026-06-26T00:00:00.000Z"),
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
});
