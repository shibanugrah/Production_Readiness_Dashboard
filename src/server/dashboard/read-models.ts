import {
  AuditLog,
  HealthCheck,
  HealthCheckRun,
  HealthCheckRunStatus,
  HealthCheckRunTriggerType,
  HealthCheckStatus,
  Incident,
  IncidentStatus,
  OperationalEvent,
  OperationalEventIngestKey,
  OperationalEventSeverity,
  OperationalEventStatus,
  OperationalEventType,
  Service,
  ServiceEnvironment,
  ServiceStatus,
  WorkspaceRole,
} from "@prisma/client";

import { prisma } from "@/server/db";
import { getCurrentWorkspaceContext } from "@/server/auth/context";
import {
  canManageWorkspace,
  canTriageOperationalEvents,
  hasWorkspaceRole,
} from "@/server/auth/permissions";
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

export type OperationalEventWithService = OperationalEvent & {
  service: Pick<Service, "id" | "name" | "slug" | "environment"> | null;
  incident?: Pick<Incident, "id" | "status" | "title"> | null;
};

export type EventIngestKeyMetadataRow = Pick<
  OperationalEventIngestKey,
  | "id"
  | "name"
  | "source"
  | "lookupId"
  | "isActive"
  | "lastUsedAt"
  | "revokedAt"
  | "createdAt"
>;

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

export type SettingsAuditLogRow = AuditLog & {
  actorUser: {
    id: string;
    name: string;
    email: string;
  };
  resourceLabel: string;
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

function fallbackAuditResourceLabel(resourceType: string) {
  if (resourceType === "SERVICE") {
    return "Service record unavailable";
  }

  if (resourceType === "OPERATIONAL_EVENT_INGEST_KEY") {
    return "Event ingestion key unavailable";
  }

  if (resourceType === "OPERATIONAL_EVENT") {
    return "Operational event unavailable";
  }

  if (resourceType === "INCIDENT") {
    return "Incident record unavailable";
  }

  return "Audit resource unavailable";
}

function auditResourceLabel(resourceType: string, label: string) {
  if (resourceType === "SERVICE") {
    return `Service · ${label}`;
  }

  if (resourceType === "OPERATIONAL_EVENT_INGEST_KEY") {
    return `Event ingestion key · ${label}`;
  }

  if (resourceType === "OPERATIONAL_EVENT") {
    return `Operational event · ${label}`;
  }

  if (resourceType === "INCIDENT") {
    return `Incident · ${label}`;
  }

  return label;
}

function redactViewerEventPayload<T extends OperationalEventWithService>(
  event: T,
): T {
  return {
    ...event,
    metadata: null,
  };
}

async function enrichAuditResourceLabels(
  workspaceId: string,
  auditLogs: Array<AuditLog & {
    actorUser: {
      id: string;
      name: string;
      email: string;
    };
  }>,
): Promise<SettingsAuditLogRow[]> {
  const resourceIds = {
    SERVICE: new Set<string>(),
    OPERATIONAL_EVENT_INGEST_KEY: new Set<string>(),
    OPERATIONAL_EVENT: new Set<string>(),
    INCIDENT: new Set<string>(),
  };

  for (const entry of auditLogs) {
    if (entry.resourceType in resourceIds) {
      resourceIds[entry.resourceType as keyof typeof resourceIds].add(entry.resourceId);
    }
  }

  const [services, ingestKeys, events, incidents] = await Promise.all([
    resourceIds.SERVICE.size
      ? prisma.service.findMany({
          where: {
            workspaceId,
            id: { in: [...resourceIds.SERVICE] },
          },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    resourceIds.OPERATIONAL_EVENT_INGEST_KEY.size
      ? prisma.operationalEventIngestKey.findMany({
          where: {
            workspaceId,
            id: { in: [...resourceIds.OPERATIONAL_EVENT_INGEST_KEY] },
          },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    resourceIds.OPERATIONAL_EVENT.size
      ? prisma.operationalEvent.findMany({
          where: {
            workspaceId,
            id: { in: [...resourceIds.OPERATIONAL_EVENT] },
          },
          select: { id: true, message: true },
        })
      : Promise.resolve([]),
    resourceIds.INCIDENT.size
      ? prisma.incident.findMany({
          where: {
            workspaceId,
            id: { in: [...resourceIds.INCIDENT] },
          },
          select: { id: true, title: true },
        })
      : Promise.resolve([]),
  ]);

  const labelsByType = {
    SERVICE: new Map(services.map((service) => [service.id, service.name])),
    OPERATIONAL_EVENT_INGEST_KEY: new Map(
      ingestKeys.map((key) => [key.id, key.name]),
    ),
    OPERATIONAL_EVENT: new Map(
      events.map((event) => [event.id, event.message]),
    ),
    INCIDENT: new Map(
      incidents.map((incident) => [incident.id, incident.title]),
    ),
  };

  return auditLogs.map((entry) => {
    const typedResourceType = entry.resourceType as keyof typeof labelsByType;
    const label = labelsByType[typedResourceType]?.get(entry.resourceId);

    return {
      ...entry,
      resourceLabel: label
        ? auditResourceLabel(entry.resourceType, label)
        : fallbackAuditResourceLabel(entry.resourceType),
    };
  });
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
    openIncidentCount,
    recentOpenIncidents,
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
      include: {
        service: {
          select: {
            id: true,
            name: true,
            slug: true,
            environment: true,
          },
        },
        incident: {
          select: {
            id: true,
            status: true,
            title: true,
          },
        },
      },
    }),
    prisma.incident.count({
      where: {
        workspaceId: dashboard.context.workspaceId,
        status: IncidentStatus.OPEN,
      },
    }),
    prisma.incident.findMany({
      where: {
        workspaceId: dashboard.context.workspaceId,
        status: IncidentStatus.OPEN,
      },
      orderBy: { startedAt: "desc" },
      take: 4,
      include: {
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
    openIncidentCount,
    recentOpenIncidents,
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

export async function getEventsReadModel(filters: {
  type?: string;
  severity?: string;
  source?: string;
  status?: string;
  range?: string;
  eventId?: string;
} = {}) {
  const dashboard = await getDashboardContext();

  if (!dashboard) {
    return null;
  }

  const since =
    filters.range === "7d"
      ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1_000)
      : filters.range === "24h"
        ? new Date(Date.now() - 24 * 60 * 60 * 1_000)
        : null;
  const where = {
    workspaceId: dashboard.context.workspaceId,
    ...(filters.type &&
    filters.type !== "all" &&
    Object.values(OperationalEventType).includes(
      filters.type as OperationalEventType,
    )
      ? { type: filters.type as OperationalEventType }
      : {}),
    ...(filters.severity &&
    filters.severity !== "all" &&
    Object.values(OperationalEventSeverity).includes(
      filters.severity as OperationalEventSeverity,
    )
      ? { severity: filters.severity as OperationalEventSeverity }
      : {}),
    ...(filters.status &&
    filters.status !== "all" &&
    Object.values(OperationalEventStatus).includes(
      filters.status as OperationalEventStatus,
    )
      ? { status: filters.status as OperationalEventStatus }
      : {}),
    ...(filters.source && filters.source !== "all"
      ? { source: filters.source }
      : {}),
    ...(since ? { occurredAt: { gte: since } } : {}),
  };

  const [events, openCount, highSeverityCount, recentFailuresCount, sources] =
    await Promise.all([
      prisma.operationalEvent.findMany({
        where,
        orderBy: { occurredAt: "desc" },
        take: 50,
        include: {
          service: {
            select: {
              id: true,
              name: true,
              slug: true,
              environment: true,
            },
          },
          incident: {
            select: {
              id: true,
              status: true,
              title: true,
            },
          },
        },
      }),
      prisma.operationalEvent.count({
        where: {
          workspaceId: dashboard.context.workspaceId,
          status: OperationalEventStatus.OPEN,
        },
      }),
      prisma.operationalEvent.count({
        where: {
          workspaceId: dashboard.context.workspaceId,
          severity: OperationalEventSeverity.ERROR,
        },
      }),
      prisma.operationalEvent.count({
        where: {
          workspaceId: dashboard.context.workspaceId,
          severity: OperationalEventSeverity.ERROR,
          occurredAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1_000) },
        },
      }),
      prisma.operationalEvent.findMany({
        where: { workspaceId: dashboard.context.workspaceId },
        select: { source: true },
        distinct: ["source"],
        orderBy: { source: "asc" },
      }),
    ]);

  const selectedEvent =
    filters.eventId && events.some((event) => event.id === filters.eventId)
      ? events.find((event) => event.id === filters.eventId) ?? null
      : filters.eventId
        ? await prisma.operationalEvent.findFirst({
            where: {
              id: filters.eventId,
              workspaceId: dashboard.context.workspaceId,
            },
            include: {
              service: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  environment: true,
                },
            },
            incident: {
              select: {
                id: true,
                status: true,
                title: true,
              },
            },
          },
        })
        : events[0] ?? null;

  const canTriageEvents = canTriageOperationalEvents(dashboard.context);

  return {
    workspace: dashboard.workspace,
    user: dashboard.context.user,
    role: dashboard.context.role,
    events: canTriageEvents ? events : events.map(redactViewerEventPayload),
    selectedEvent:
      selectedEvent && !canTriageEvents
        ? redactViewerEventPayload(selectedEvent)
        : selectedEvent,
    openCount,
    highSeverityCount,
    recentFailuresCount,
    sourceCount: sources.length,
    sources: sources.map((item) => item.source),
    filters: {
      type: filters.type ?? "all",
      severity: filters.severity ?? "all",
      status: filters.status ?? "all",
      source: filters.source ?? "all",
      range: filters.range ?? "all",
    },
    eventTypes: Object.values(OperationalEventType),
    severities: Object.values(OperationalEventSeverity),
    statuses: Object.values(OperationalEventStatus),
    canTriageEvents,
  };
}

export async function getIncidentsReadModel(filters: {
  status?: string;
  severity?: string;
  range?: string;
  incidentId?: string;
} = {}) {
  const dashboard = await getDashboardContext();

  if (!dashboard) {
    return null;
  }

  const resolvedSince =
    filters.range === "7d"
      ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1_000)
      : new Date(Date.now() - 24 * 60 * 60 * 1_000);
  const where = {
    workspaceId: dashboard.context.workspaceId,
    ...(filters.status &&
    filters.status !== "all" &&
    Object.values(IncidentStatus).includes(filters.status as IncidentStatus)
      ? { status: filters.status as IncidentStatus }
      : {}),
    ...(filters.severity &&
    filters.severity !== "all" &&
    Object.values(OperationalEventSeverity).includes(
      filters.severity as OperationalEventSeverity,
    )
      ? { severity: filters.severity as OperationalEventSeverity }
      : {}),
  };

  const [
    incidents,
    openCount,
    highSeverityOpenCount,
    resolvedRecentCount,
  ] = await Promise.all([
    prisma.incident.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: {
        service: {
          select: {
            id: true,
            name: true,
            slug: true,
            environment: true,
          },
        },
        ownerUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        sourceEvent: {
          select: {
            id: true,
            message: true,
            source: true,
            type: true,
            severity: true,
            status: true,
            occurredAt: true,
          },
        },
      },
    }),
    prisma.incident.count({
      where: {
        workspaceId: dashboard.context.workspaceId,
        status: IncidentStatus.OPEN,
      },
    }),
    prisma.incident.count({
      where: {
        workspaceId: dashboard.context.workspaceId,
        status: IncidentStatus.OPEN,
        severity: OperationalEventSeverity.ERROR,
      },
    }),
    prisma.incident.count({
      where: {
        workspaceId: dashboard.context.workspaceId,
        status: IncidentStatus.RESOLVED,
        resolvedAt: { gte: resolvedSince },
      },
    }),
  ]);

  const selectedIncident =
    filters.incidentId &&
    incidents.some((incident) => incident.id === filters.incidentId)
      ? incidents.find((incident) => incident.id === filters.incidentId) ?? null
      : filters.incidentId
        ? await prisma.incident.findFirst({
            where: {
              id: filters.incidentId,
              workspaceId: dashboard.context.workspaceId,
            },
            include: {
              service: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  environment: true,
                },
              },
              ownerUser: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
              sourceEvent: {
                select: {
                  id: true,
                  message: true,
                  source: true,
                  type: true,
                  severity: true,
                  status: true,
                  occurredAt: true,
                },
              },
            },
          })
        : incidents[0] ?? null;

  const canTriageEvents = canTriageOperationalEvents(dashboard.context);
  const timeline = selectedIncident && canTriageEvents
    ? await prisma.auditLog.findMany({
        where: {
          workspaceId: dashboard.context.workspaceId,
          OR: [
            {
              resourceType: "INCIDENT",
              resourceId: selectedIncident.id,
            },
            ...(selectedIncident.sourceEventId
              ? [
                  {
                    resourceType: "OPERATIONAL_EVENT",
                    resourceId: selectedIncident.sourceEventId,
                  },
                ]
              : []),
          ],
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
      })
    : [];

  return {
    workspace: dashboard.workspace,
    user: dashboard.context.user,
    role: dashboard.context.role,
    incidents,
    selectedIncident,
    timeline,
    openCount,
    highSeverityOpenCount,
    resolvedRecentCount,
    canTriageEvents,
    filters: {
      status: filters.status ?? "all",
      severity: filters.severity ?? "all",
      range: filters.range ?? "24h",
    },
    statuses: Object.values(IncidentStatus),
    severities: Object.values(OperationalEventSeverity),
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

  const canViewServiceAudit = hasWorkspaceRole(
    dashboard.context,
    WorkspaceRole.ADMIN,
  );
  const auditLogs = canViewServiceAudit
    ? await prisma.auditLog.findMany({
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
      })
    : [];

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

  const canViewSettingsDetails = hasWorkspaceRole(
    dashboard.context,
    WorkspaceRole.ADMIN,
  );
  const [latestScheduledRun, auditLogs, eventIngestKeys] = await Promise.all([
    prisma.healthCheckRun.findFirst({
      where: {
        workspaceId: dashboard.context.workspaceId,
        triggerType: HealthCheckRunTriggerType.SCHEDULED,
      },
      orderBy: { startedAt: "desc" },
    }),
    canViewSettingsDetails
      ? prisma.auditLog.findMany({
          where: {
            workspaceId: dashboard.context.workspaceId,
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
        })
      : Promise.resolve([]),
    canViewSettingsDetails
      ? prisma.operationalEventIngestKey.findMany({
          where: { workspaceId: dashboard.context.workspaceId },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            source: true,
            lookupId: true,
            isActive: true,
            lastUsedAt: true,
            revokedAt: true,
            createdAt: true,
          },
        })
      : Promise.resolve([]),
  ]);
  const auditLogsWithResourceLabels = canViewSettingsDetails
    ? await enrichAuditResourceLabels(
        dashboard.context.workspaceId,
        auditLogs,
      )
    : [];

  return {
    workspace: dashboard.workspace,
    user: dashboard.context.user,
    role: dashboard.context.role,
    auditLogs: auditLogsWithResourceLabels,
    latestScheduledRun,
    eventIngestKeys,
    canViewSettingsDetails,
    canManageEventIngestKeys: canManageWorkspace(dashboard.context),
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
export type EventsReadModel = NonNullable<
  Awaited<ReturnType<typeof getEventsReadModel>>
>;
export type IncidentsReadModel = NonNullable<
  Awaited<ReturnType<typeof getIncidentsReadModel>>
>;
export type OperationalEventRow = OperationalEvent;
export type SettingsReadModel = NonNullable<
  Awaited<ReturnType<typeof getSettingsReadModel>>
>;
