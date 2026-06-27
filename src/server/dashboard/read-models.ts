import {
  HealthCheck,
  HealthCheckStatus,
  OperationalEvent,
  Service,
  ServiceEnvironment,
  ServiceStatus,
} from "@prisma/client";

import { prisma } from "@/server/db";
import { getCurrentWorkspaceContext } from "@/server/auth/context";

const recentRangeHours = 24;

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
  const [services, failedChecks, failedCheckCount, operationalEvents] = await Promise.all([
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
