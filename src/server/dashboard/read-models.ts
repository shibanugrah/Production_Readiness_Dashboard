import {
  HealthCheck,
  HealthCheckRun,
  HealthCheckRunStatus,
  HealthCheckRunTriggerType,
  HealthCheckStatus,
  OperationalEvent,
  Service,
  ServiceEnvironment,
  ServiceStatus,
} from "@prisma/client";

import { prisma } from "@/server/db";
import { getCurrentWorkspaceContext } from "@/server/auth/context";
import { serviceAuditActions } from "@/server/services/management";

const recentRangeHours = 24;
const serviceAuditActionValues = Object.values(serviceAuditActions);

type LatestCheck = Pick<
  HealthCheck,
  | "id"
  | "status"
  | "httpStatus"
  | "responseTimeMs"
  | "observedVersion"
  | "migrationVersion"
  | "message"
  | "checkedAt"
>;

export type ServiceWithLatestCheck = Pick<
  Service,
  | "id"
  | "workspaceId"
  | "name"
  | "slug"
  | "baseUrl"
  | "healthPath"
  | "environment"
  | "expectedVersion"
  | "status"
  | "isActive"
  | "lastCheckedAt"
  | "lastHealthyAt"
> & {
  healthChecks: LatestCheck[];
};

export type DisplayStatus = ServiceStatus;

export type ReadinessState = "Ready" | "Needs Attention" | "Blocked";

export type StatusCounts = Record<DisplayStatus, number>;

export type RecentFailedCheck = Pick<
  HealthCheck,
  | "id"
  | "status"
  | "httpStatus"
  | "responseTimeMs"
  | "observedVersion"
  | "message"
  | "checkedAt"
> & {
  service: Pick<Service, "id" | "name" | "slug" | "environment">;
};

export type SchedulerRunEvidence = Pick<
  HealthCheckRun,
  | "status"
  | "startedAt"
  | "finishedAt"
  | "checkedCount"
  | "healthyCount"
  | "degradedCount"
  | "downCount"
  | "skippedCount"
  | "errorCount"
  | "errorMessage"
>;

export type SchedulerMonitoringState = {
  kind: "not-configured" | "active" | "attention" | "skipped" | "running";
  label: string;
  tone: "slate" | "green" | "amber" | "rose" | "blue";
};

export type DashboardServiceRow = ServiceWithLatestCheck & {
  displayStatus: DisplayStatus;
  latestCheck: LatestCheck | null;
};

export async function getDashboardContext() {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    return null;
  }

  return {
    workspace: context.workspace,
    context,
  };
}

export function getDisplayServiceStatus(
  service: Pick<ServiceWithLatestCheck, "isActive" | "status" | "healthChecks">,
): DisplayStatus {
  if (!service.isActive || service.healthChecks.length === 0) {
    return ServiceStatus.UNKNOWN;
  }

  return service.status;
}

export function calculateStatusCounts(
  services: Array<Pick<ServiceWithLatestCheck, "isActive" | "status" | "healthChecks">>,
): StatusCounts {
  const counts = {
    [ServiceStatus.HEALTHY]: 0,
    [ServiceStatus.DEGRADED]: 0,
    [ServiceStatus.DOWN]: 0,
    [ServiceStatus.UNKNOWN]: 0,
  };

  for (const service of services) {
    if (!service.isActive) {
      continue;
    }

    counts[getDisplayServiceStatus(service)] += 1;
  }

  return counts;
}

export function calculateReadinessState(counts: StatusCounts): ReadinessState {
  if (counts[ServiceStatus.DOWN] > 0 || counts[ServiceStatus.UNKNOWN] > 0) {
    return "Blocked";
  }

  if (counts[ServiceStatus.DEGRADED] > 0) {
    return "Needs Attention";
  }

  return "Ready";
}

export function toDashboardServiceRow(
  service: ServiceWithLatestCheck,
): DashboardServiceRow {
  return {
    ...service,
    displayStatus: getDisplayServiceStatus(service),
    latestCheck: service.healthChecks[0] ?? null,
  };
}

export function getSchedulerMonitoringState(
  latestScheduledRun: SchedulerRunEvidence | null,
  relativeStartedAt = "",
): SchedulerMonitoringState {
  if (!latestScheduledRun) {
    return {
      kind: "not-configured",
      label: "Not configured — no scheduled run evidence yet",
      tone: "slate",
    };
  }

  if (latestScheduledRun.status === HealthCheckRunStatus.COMPLETED) {
    return {
      kind: "active",
      label: `Active — last scheduled run ${relativeStartedAt}`.trim(),
      tone: "green",
    };
  }

  if (latestScheduledRun.status === HealthCheckRunStatus.FAILED) {
    return {
      kind: "attention",
      label: "Attention required — latest scheduled run failed",
      tone: "rose",
    };
  }

  if (latestScheduledRun.status === HealthCheckRunStatus.SKIPPED) {
    return {
      kind: "skipped",
      label: "Skipped — another run was active",
      tone: "amber",
    };
  }

  return {
    kind: "running",
    label: "Running — scheduled run in progress",
    tone: "blue",
  };
}

async function listServicesWithLatestCheck(workspaceId: string) {
  return prisma.service.findMany({
    where: { workspaceId },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: {
      healthChecks: {
        orderBy: { checkedAt: "desc" },
        take: 36,
        select: {
          id: true,
          status: true,
          httpStatus: true,
          responseTimeMs: true,
          observedVersion: true,
          migrationVersion: true,
          message: true,
          checkedAt: true,
        },
      },
    },
  });
}

export async function getOverviewSummary() {
  const dashboard = await getDashboardContext();

  if (!dashboard) {
    return null;
  }

  const since = new Date(Date.now() - recentRangeHours * 60 * 60 * 1_000);
  const failedCheckWhere = {
    workspaceId: dashboard.context.workspaceId,
    status: HealthCheckStatus.FAILURE,
    checkedAt: { gte: since },
  };
  const [
    services,
    failedChecks,
    failedCheckCount,
    operationalEvents,
    latestCompletedRun,
    latestScheduledRun,
    recentHealthCheckRuns,
  ] = await Promise.all([
    listServicesWithLatestCheck(dashboard.context.workspaceId),
    prisma.healthCheck.findMany({
      where: failedCheckWhere,
      orderBy: { checkedAt: "desc" },
      take: 8,
      select: {
        id: true,
        status: true,
        httpStatus: true,
        responseTimeMs: true,
        observedVersion: true,
        message: true,
        checkedAt: true,
        service: {
          select: {
            id: true,
            name: true,
            slug: true,
            environment: true,
          },
        },
      },
    }),
    prisma.healthCheck.count({ where: failedCheckWhere }),
    prisma.operationalEvent.findMany({
      where: { workspaceId: dashboard.context.workspaceId },
      orderBy: { occurredAt: "desc" },
      take: 5,
    }),
    prisma.healthCheckRun.findFirst({
      where: {
        workspaceId: dashboard.context.workspaceId,
        status: HealthCheckRunStatus.COMPLETED,
      },
      orderBy: { startedAt: "desc" },
    }),
    prisma.healthCheckRun.findFirst({
      where: {
        workspaceId: dashboard.context.workspaceId,
        triggerType: HealthCheckRunTriggerType.SCHEDULED,
      },
      orderBy: { startedAt: "desc" },
    }),
    prisma.healthCheckRun.findMany({
      where: { workspaceId: dashboard.context.workspaceId },
      orderBy: { startedAt: "desc" },
      take: 5,
      include: {
        requestedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
  ]);

  const serviceRows = services.map(toDashboardServiceRow);
  const activeServices = services.filter((service) => service.isActive);
  const counts = calculateStatusCounts(services);

  return {
    workspace: dashboard.workspace,
    user: dashboard.context.user,
    role: dashboard.context.role,
    services: serviceRows,
    activeServiceCount: activeServices.length,
    counts,
    readiness: calculateReadinessState(counts),
    failedCheckCount,
    failedChecks,
    operationalEvents,
    latestCompletedRun,
    latestScheduledRun,
    recentHealthCheckRuns,
    rangeLabel: `Last ${recentRangeHours} hours`,
  };
}

export async function getServiceListReadModel(filters: {
  query?: string;
  environment?: string;
  status?: string;
} = {}) {
  const dashboard = await getDashboardContext();

  if (!dashboard) {
    return null;
  }

  const services = (await listServicesWithLatestCheck(
    dashboard.context.workspaceId,
  )).map(toDashboardServiceRow);
  const query = filters.query?.trim().toLowerCase() ?? "";
  const environment = filters.environment;
  const status = filters.status;

  const filteredServices = services.filter((service) => {
    const matchesQuery =
      !query ||
      service.name.toLowerCase().includes(query) ||
      service.slug.toLowerCase().includes(query);
    const matchesEnvironment =
      !environment ||
      environment === "all" ||
      service.environment === environment;
    const matchesStatus =
      !status || status === "all" || service.displayStatus === status;

    return matchesQuery && matchesEnvironment && matchesStatus;
  });

  return {
    workspace: dashboard.workspace,
    user: dashboard.context.user,
    role: dashboard.context.role,
    services,
    filteredServices,
    counts: calculateStatusCounts(services),
    environments: Object.values(ServiceEnvironment),
  };
}

export async function getServiceDetailReadModel(serviceId: string) {
  const dashboard = await getDashboardContext();

  if (!dashboard) {
    return null;
  }

  const service = await prisma.service.findFirst({
    where: {
      id: serviceId,
      workspaceId: dashboard.context.workspaceId,
    },
    include: {
      healthChecks: {
        orderBy: { checkedAt: "desc" },
        take: 30,
      },
    },
  });

  if (!service) {
    return null;
  }

  const auditLogs = await prisma.auditLog.findMany({
    where: {
      workspaceId: dashboard.context.workspaceId,
      resourceType: "SERVICE",
      resourceId: serviceId,
      action: { in: serviceAuditActionValues },
    },
    orderBy: { createdAt: "desc" },
    take: 12,
    include: {
      actorUser: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  const serviceRow = toDashboardServiceRow(service);
  const latestCheck = serviceRow.latestCheck;
  const latestFailedCheck =
    service.healthChecks.find((check) => check.status === HealthCheckStatus.FAILURE) ??
    null;

  return {
    workspace: dashboard.workspace,
    user: dashboard.context.user,
    role: dashboard.context.role,
    service: serviceRow,
    history: service.healthChecks,
    latestCheck,
    latestFailedCheck,
    auditLogs,
    environments: Object.values(ServiceEnvironment),
  };
}

export async function getSettingsReadModel() {
  const dashboard = await getDashboardContext();

  if (!dashboard) {
    return null;
  }

  const [auditLogs, latestScheduledRun] = await Promise.all([
    prisma.auditLog.findMany({
      where: {
        workspaceId: dashboard.context.workspaceId,
        resourceType: "SERVICE",
        action: { in: serviceAuditActionValues },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        actorUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
    prisma.healthCheckRun.findFirst({
      where: {
        workspaceId: dashboard.context.workspaceId,
        triggerType: HealthCheckRunTriggerType.SCHEDULED,
      },
      orderBy: { startedAt: "desc" },
    }),
  ]);

  return {
    workspace: dashboard.workspace,
    user: dashboard.context.user,
    role: dashboard.context.role,
    auditLogs,
    latestScheduledRun,
  };
}

export type OverviewSummary = NonNullable<
  Awaited<ReturnType<typeof getOverviewSummary>>
>;
export type ServiceListReadModel = NonNullable<
  Awaited<ReturnType<typeof getServiceListReadModel>>
>;
export type ServiceDetailReadModel = NonNullable<
  Awaited<ReturnType<typeof getServiceDetailReadModel>>
>;
export type OperationalEventRow = OperationalEvent;
export type SettingsReadModel = NonNullable<
  Awaited<ReturnType<typeof getSettingsReadModel>>
>;
