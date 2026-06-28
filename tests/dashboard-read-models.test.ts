import {
  HealthCheckRunStatus,
  HealthCheckRunTriggerType,
  OperationalEventSeverity,
  OperationalEventStatus,
  OperationalEventType,
  ServiceEnvironment,
  ServiceStatus,
  WorkspaceRole,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  calculateReadinessState,
  calculateStatusCounts,
  getDisplayServiceStatus,
  getEventsReadModel,
  getOverviewSummary,
  getSchedulerMonitoringState,
  getServiceDetailReadModel,
  getServiceListReadModel,
  getSettingsReadModel,
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
    healthCheck: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    healthCheckRun: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    operationalEvent: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    operationalEventIngestKey: {
      findMany: vi.fn(),
    },
    incident: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
    },
    auditLog: {
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

function scheduledRunFixture(status: HealthCheckRunStatus) {
  return {
    id: "scheduled_run_1",
    workspaceId: "workspace_a",
    triggerType: HealthCheckRunTriggerType.SCHEDULED,
    status,
    requestedByUserId: null,
    startedAt: new Date("2026-06-26T00:00:00.000Z"),
    finishedAt: new Date("2026-06-26T00:00:05.000Z"),
    checkedCount: 2,
    healthyCount: 1,
    degradedCount: 0,
    downCount: 1,
    skippedCount: 0,
    errorCount: 0,
    errorMessage: status === HealthCheckRunStatus.FAILED ? "runner failed" : null,
    createdAt: new Date("2026-06-26T00:00:00.000Z"),
    updatedAt: new Date("2026-06-26T00:00:05.000Z"),
  };
}

function dashboardServiceFixture(
  overrides: Partial<{
    id: string;
    name: string;
    slug: string;
    baseUrl: string;
    environment: ServiceEnvironment;
    status: ServiceStatus;
    isActive: boolean;
  }> = {},
) {
  const id = overrides.id ?? "service_1";

  return {
    id,
    workspaceId: "workspace_a",
    name: overrides.name ?? "Production API",
    slug: overrides.slug ?? "production-api",
    baseUrl: overrides.baseUrl ?? "https://production.example.test",
    healthPath: "/api/health",
    environment: overrides.environment ?? ServiceEnvironment.PRODUCTION,
    expectedVersion: null,
    status: overrides.status ?? ServiceStatus.UNKNOWN,
    isActive: overrides.isActive ?? true,
    lastCheckedAt: null,
    lastHealthyAt: null,
    checkLockToken: null,
    checkLockExpiresAt: null,
    createdAt: new Date("2026-06-26T00:00:00.000Z"),
    updatedAt: new Date("2026-06-26T00:00:00.000Z"),
    healthChecks: [],
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

  it("keeps service configuration audit rows out of Viewer service details", async () => {
    vi.mocked(prisma.auditLog.findMany).mockClear();
    vi.mocked(getCurrentWorkspaceContext).mockResolvedValue({
      workspaceId: "workspace_public",
      userId: "public_viewer",
      user: {
        id: "public_viewer",
        name: "Public Demo Viewer",
        email: "public-viewer@example.invalid",
      },
      workspace: {
        id: "workspace_public",
        name: "Public Demo",
        slug: "public-recruiter-demo",
      },
      role: WorkspaceRole.VIEWER,
    });
    vi.mocked(prisma.service.findFirst).mockResolvedValue(
      dashboardServiceFixture({
        id: "service_self_monitor",
        name: "Production Readiness Dashboard",
        slug: "production-readiness-dashboard",
        status: ServiceStatus.HEALTHY,
      }) as never,
    );

    const model = await getServiceDetailReadModel("service_self_monitor");

    expect(model?.auditLogs).toEqual([]);
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
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

  it("defaults service filtering to all environments without hiding production services", async () => {
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
    vi.mocked(prisma.service.findMany).mockResolvedValue([
      dashboardServiceFixture({
        id: "service_prod",
        slug: "production-dashboard",
        environment: ServiceEnvironment.PRODUCTION,
      }),
      dashboardServiceFixture({
        id: "service_local",
        slug: "local-dashboard",
        name: "Local Dashboard",
        baseUrl: "http://app:3000",
        environment: ServiceEnvironment.LOCAL,
      }),
    ] as never);

    const allServices = await getServiceListReadModel({ environment: "all" });
    const productionServices = await getServiceListReadModel({
      environment: ServiceEnvironment.PRODUCTION,
    });

    expect(allServices?.filteredServices.map((service) => service.id)).toEqual([
      "service_prod",
      "service_local",
    ]);
    expect(productionServices?.filteredServices.map((service) => service.id)).toEqual([
      "service_prod",
    ]);
    expect(prisma.service.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId: "workspace_a" },
      }),
    );
  });

  it("keeps latest run evidence workspace-scoped without claiming scheduling", async () => {
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
    vi.mocked(prisma.healthCheck.findMany).mockResolvedValue([]);
    vi.mocked(prisma.healthCheck.count).mockResolvedValue(0);
    vi.mocked(prisma.operationalEvent.findMany).mockResolvedValue([]);
    vi.mocked(prisma.incident.count).mockResolvedValue(0);
    vi.mocked(prisma.incident.findMany).mockResolvedValue([]);
    vi.mocked(prisma.healthCheckRun.findFirst)
      .mockResolvedValueOnce({
        id: "run_1",
        workspaceId: "workspace_a",
        triggerType: HealthCheckRunTriggerType.MANUAL,
        status: HealthCheckRunStatus.COMPLETED,
        requestedByUserId: "user_1",
        startedAt: new Date("2026-06-26T00:00:00.000Z"),
        finishedAt: new Date("2026-06-26T00:00:05.000Z"),
        checkedCount: 1,
        healthyCount: 1,
        degradedCount: 0,
        downCount: 0,
        skippedCount: 0,
        errorCount: 0,
        errorMessage: null,
        createdAt: new Date("2026-06-26T00:00:00.000Z"),
        updatedAt: new Date("2026-06-26T00:00:05.000Z"),
      })
      .mockResolvedValueOnce(null);
    vi.mocked(prisma.healthCheckRun.findMany).mockResolvedValue([]);
    vi.mocked(prisma.operationalEvent.findMany).mockResolvedValue([]);

    const summary = await getOverviewSummary();

    expect(summary?.latestCompletedRun?.id).toBe("run_1");
    expect(summary?.latestScheduledRun).toBeNull();
    expect(prisma.healthCheckRun.findFirst).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          workspaceId: "workspace_a",
          status: HealthCheckRunStatus.COMPLETED,
        },
      }),
    );
    expect(prisma.healthCheckRun.findFirst).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          workspaceId: "workspace_a",
          triggerType: HealthCheckRunTriggerType.SCHEDULED,
        },
      }),
    );
    expect(prisma.healthCheckRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId: "workspace_a" },
      }),
    );
  });

  it("keeps operational events workspace-scoped", async () => {
    vi.mocked(prisma.operationalEvent.findMany).mockClear();
    vi.mocked(prisma.operationalEvent.count).mockClear();
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
    vi.mocked(prisma.operationalEvent.findMany)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ source: "local-demo" } as never]);
    vi.mocked(prisma.operationalEvent.count).mockResolvedValue(0);

    const model = await getEventsReadModel({
      source: "local-demo",
      severity: OperationalEventSeverity.ERROR,
      status: OperationalEventStatus.OPEN,
      type: OperationalEventType.JOB,
    });

    expect(model?.events).toEqual([]);
    expect(prisma.operationalEvent.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: "workspace_a",
          source: "local-demo",
          severity: OperationalEventSeverity.ERROR,
          status: OperationalEventStatus.OPEN,
          type: OperationalEventType.JOB,
        }),
      }),
    );
    expect(prisma.operationalEvent.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: "workspace_a",
        }),
      }),
    );
  });

  it("redacts raw operational event metadata for Viewer read models", async () => {
    vi.mocked(prisma.operationalEvent.findMany).mockClear();
    vi.mocked(prisma.operationalEvent.count).mockClear();
    vi.mocked(getCurrentWorkspaceContext).mockResolvedValue({
      workspaceId: "workspace_public",
      userId: "public_viewer",
      user: {
        id: "public_viewer",
        name: "Public Demo Viewer",
        email: "public-viewer@example.invalid",
      },
      workspace: {
        id: "workspace_public",
        name: "Public Demo",
        slug: "public-recruiter-demo",
      },
      role: WorkspaceRole.VIEWER,
    });
    vi.mocked(prisma.operationalEvent.findMany)
      .mockResolvedValueOnce([
        {
          id: "event_public",
          workspaceId: "workspace_public",
          serviceId: null,
          source: "public-demo",
          type: OperationalEventType.JOB,
          severity: OperationalEventSeverity.ERROR,
          status: OperationalEventStatus.OPEN,
          message: "Job failed",
          externalReference: "job/1",
          errorMessage: "Extractor failed",
          metadata: { rawPayload: "internal detail" },
          payloadHash: "hash",
          idempotencyKey: "job-1",
          acknowledgedAt: null,
          acknowledgedByUserId: null,
          resolvedAt: null,
          resolvedByUserId: null,
          resolutionNote: null,
          occurredAt: new Date("2026-06-27T00:00:00.000Z"),
          createdAt: new Date("2026-06-27T00:00:01.000Z"),
          updatedAt: new Date("2026-06-27T00:00:01.000Z"),
          service: null,
          incident: null,
        },
      ] as never)
      .mockResolvedValueOnce([{ source: "public-demo" } as never]);
    vi.mocked(prisma.operationalEvent.count).mockResolvedValue(0);

    const model = await getEventsReadModel();

    expect(model?.canTriageEvents).toBe(false);
    expect(model?.events[0].metadata).toBeNull();
    expect(model?.selectedEvent?.metadata).toBeNull();
  });

  it("enriches settings audit rows with workspace-safe resource labels", async () => {
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
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([
      {
        id: "audit_1",
        workspaceId: "workspace_a",
        actorUserId: "user_1",
        action: "SERVICE_UPDATED",
        resourceType: "SERVICE",
        resourceId: "svc_123",
        metadataJson: null,
        createdAt: new Date("2026-06-27T00:00:00.000Z"),
        actorUser: {
          id: "user_1",
          name: "Demo Owner",
          email: "owner@example.local",
        },
      },
      {
        id: "audit_2",
        workspaceId: "workspace_a",
        actorUserId: "user_1",
        action: "EVENT_INGEST_KEY_CREATED",
        resourceType: "OPERATIONAL_EVENT_INGEST_KEY",
        resourceId: "key_123",
        metadataJson: null,
        createdAt: new Date("2026-06-27T00:01:00.000Z"),
        actorUser: {
          id: "user_1",
          name: "Demo Owner",
          email: "owner@example.local",
        },
      },
      {
        id: "audit_3",
        workspaceId: "workspace_a",
        actorUserId: "user_1",
        action: "OPERATIONAL_EVENT_ACKNOWLEDGED",
        resourceType: "OPERATIONAL_EVENT",
        resourceId: "event_123",
        metadataJson: null,
        createdAt: new Date("2026-06-27T00:02:00.000Z"),
        actorUser: {
          id: "user_1",
          name: "Demo Owner",
          email: "owner@example.local",
        },
      },
      {
        id: "audit_4",
        workspaceId: "workspace_a",
        actorUserId: "user_1",
        action: "INCIDENT_CREATED",
        resourceType: "INCIDENT",
        resourceId: "incident_123",
        metadataJson: null,
        createdAt: new Date("2026-06-27T00:03:00.000Z"),
        actorUser: {
          id: "user_1",
          name: "Demo Owner",
          email: "owner@example.local",
        },
      },
      {
        id: "audit_5",
        workspaceId: "workspace_a",
        actorUserId: "user_1",
        action: "SERVICE_UPDATED",
        resourceType: "SERVICE",
        resourceId: "svc_deleted",
        metadataJson: null,
        createdAt: new Date("2026-06-27T00:04:00.000Z"),
        actorUser: {
          id: "user_1",
          name: "Demo Owner",
          email: "owner@example.local",
        },
      },
    ] as never);
    vi.mocked(prisma.healthCheckRun.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.operationalEventIngestKey.findMany)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: "key_123", name: "Smoke test events" },
      ] as never);
    vi.mocked(prisma.service.findMany).mockResolvedValue([
      { id: "svc_123", name: "Codex Manual 105551" },
    ] as never);
    vi.mocked(prisma.operationalEvent.findMany).mockResolvedValue([
      { id: "event_123", message: "Local smoke test event" },
    ] as never);
    vi.mocked(prisma.incident.findMany).mockResolvedValue([
      { id: "incident_123", title: "Local smoke test incident" },
    ] as never);

    const model = await getSettingsReadModel();

    expect(model?.auditLogs.map((entry) => entry.resourceLabel)).toEqual([
      "Service · Codex Manual 105551",
      "Event ingestion key · Smoke test events",
      "Operational event · Local smoke test event",
      "Incident · Local smoke test incident",
      "Service record unavailable",
    ]);
    expect(model?.auditLogs.map((entry) => entry.resourceLabel).join(" ")).not.toContain(
      "svc_123",
    );
    expect(prisma.service.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          workspaceId: "workspace_a",
          id: { in: ["svc_123", "svc_deleted"] },
        },
      }),
    );
  });

  it("keeps Viewer settings access away from ingestion-key metadata and private audit rows", async () => {
    vi.mocked(prisma.auditLog.findMany).mockClear();
    vi.mocked(prisma.operationalEventIngestKey.findMany).mockClear();
    vi.mocked(prisma.service.findMany).mockClear();
    vi.mocked(getCurrentWorkspaceContext).mockResolvedValue({
      workspaceId: "workspace_public",
      userId: "public_viewer",
      user: {
        id: "public_viewer",
        name: "Public Demo Viewer",
        email: "public-viewer@example.invalid",
      },
      workspace: {
        id: "workspace_public",
        name: "Public Demo",
        slug: "public-recruiter-demo",
      },
      role: WorkspaceRole.VIEWER,
    });
    vi.mocked(prisma.healthCheckRun.findFirst).mockResolvedValue(null);

    const model = await getSettingsReadModel();

    expect(model?.canViewSettingsDetails).toBe(false);
    expect(model?.eventIngestKeys).toEqual([]);
    expect(model?.auditLogs).toEqual([]);
    expect(prisma.operationalEventIngestKey.findMany).not.toHaveBeenCalled();
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
  });

  it("renders scheduler evidence as not configured without a scheduled run", () => {
    expect(getSchedulerMonitoringState(null).label).toBe(
      "Not configured — no scheduled run evidence yet",
    );
  });

  it("renders scheduler evidence as active only after a completed scheduled run", () => {
    expect(
      getSchedulerMonitoringState(
        scheduledRunFixture(HealthCheckRunStatus.COMPLETED),
        "2 minutes ago",
      ).label,
    ).toBe("Active — last scheduled run 2 minutes ago");
  });

  it("renders failed scheduled runs as attention required", () => {
    expect(
      getSchedulerMonitoringState(
        scheduledRunFixture(HealthCheckRunStatus.FAILED),
        "2 minutes ago",
      ).label,
    ).toBe("Attention required — latest scheduled run failed");
  });

  it("renders skipped scheduled runs as overlap-safe", () => {
    expect(
      getSchedulerMonitoringState(
        scheduledRunFixture(HealthCheckRunStatus.SKIPPED),
        "2 minutes ago",
      ).label,
    ).toBe("Skipped — another run was active");
  });
});
