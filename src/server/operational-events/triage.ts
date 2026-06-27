import {
  Incident,
  IncidentStatus,
  OperationalEvent,
  OperationalEventSeverity,
  OperationalEventStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";

import { AuthenticatedWorkspaceContext } from "@/server/auth/context";
import {
  PermissionDeniedError,
  canTriageOperationalEvents,
} from "@/server/auth/permissions";
import { prisma } from "@/server/db";

export const operationalEventAuditActions = {
  acknowledged: "OPERATIONAL_EVENT_ACKNOWLEDGED",
  resolved: "OPERATIONAL_EVENT_RESOLVED",
  reopened: "OPERATIONAL_EVENT_REOPENED",
  incidentCreated: "INCIDENT_CREATED",
  incidentResolved: "INCIDENT_RESOLVED",
} as const;

const eventResourceType = "OPERATIONAL_EVENT";
const incidentResourceType = "INCIDENT";
const maxNoteLength = 500;

type TriageClient = Pick<
  PrismaClient,
  "$transaction" | "operationalEvent" | "incident" | "auditLog"
>;

const defaultClient = prisma as TriageClient;

export class EventTriageValidationError extends Error {
  constructor(readonly fieldErrors: Record<string, string[]>) {
    super("Operational event triage validation failed.");
    this.name = "EventTriageValidationError";
  }
}

export class EventTriageNotFoundError extends Error {
  constructor(message = "Operational event was not found in this workspace.") {
    super(message);
    this.name = "EventTriageNotFoundError";
  }
}

export class IncidentNotFoundError extends Error {
  constructor() {
    super("Incident was not found in this workspace.");
    this.name = "IncidentNotFoundError";
  }
}

export class DuplicateIncidentError extends Error {
  constructor(readonly incidentId: string) {
    super("An incident already exists for this operational event.");
    this.name = "DuplicateIncidentError";
  }
}

function assertCanTriage(context: Pick<AuthenticatedWorkspaceContext, "role">) {
  if (!canTriageOperationalEvents(context)) {
    throw new PermissionDeniedError(
      "Your role cannot triage operational events in this workspace.",
    );
  }
}

function cleanNote(value: string, field = "note") {
  const note = value.trim();

  if (!note) {
    throw new EventTriageValidationError({
      [field]: ["A short note is required."],
    });
  }

  if (note.length > maxNoteLength) {
    throw new EventTriageValidationError({
      [field]: [`Note must be ${maxNoteLength} characters or fewer.`],
    });
  }

  return note;
}

function incidentTitle(event: OperationalEvent) {
  return event.message.slice(0, 120);
}

function incidentSummary(event: OperationalEvent) {
  return (event.errorMessage ?? event.message).slice(0, 500);
}

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

async function getWorkspaceEvent(
  context: AuthenticatedWorkspaceContext,
  eventId: string,
  client: TriageClient,
) {
  const event = await client.operationalEvent.findFirst({
    where: {
      id: eventId,
      workspaceId: context.workspaceId,
    },
  });

  if (!event) {
    throw new EventTriageNotFoundError();
  }

  return event;
}

function eventAuditMetadata(summary: string, extra: Record<string, unknown> = {}) {
  return {
    summary,
    ...extra,
  };
}

export async function acknowledgeOperationalEvent(
  context: AuthenticatedWorkspaceContext,
  eventId: string,
  client: TriageClient = defaultClient,
) {
  assertCanTriage(context);
  const event = await getWorkspaceEvent(context, eventId, client);

  if (event.status !== OperationalEventStatus.OPEN) {
    throw new EventTriageValidationError({
      status: ["Only open events can be acknowledged."],
    });
  }

  return client.$transaction(async (tx) => {
    const updated = await tx.operationalEvent.update({
      where: { id: event.id },
      data: {
        status: OperationalEventStatus.ACKNOWLEDGED,
        acknowledgedAt: new Date(),
        acknowledgedByUserId: context.user.id,
      },
    });

    await tx.auditLog.create({
      data: {
        workspaceId: context.workspaceId,
        actorUserId: context.user.id,
        action: operationalEventAuditActions.acknowledged,
        resourceType: eventResourceType,
        resourceId: event.id,
        metadataJson: eventAuditMetadata("Operational event acknowledged", {
          source: event.source,
          type: event.type,
          severity: event.severity,
        }),
      },
    });

    return updated;
  });
}

export async function resolveOperationalEvent(
  context: AuthenticatedWorkspaceContext,
  eventId: string,
  note: string,
  client: TriageClient = defaultClient,
) {
  assertCanTriage(context);
  const resolutionNote = cleanNote(note, "resolutionNote");
  const event = await getWorkspaceEvent(context, eventId, client);

  if (event.status === OperationalEventStatus.RESOLVED) {
    throw new EventTriageValidationError({
      status: ["Event is already resolved."],
    });
  }

  return client.$transaction(async (tx) => {
    const updated = await tx.operationalEvent.update({
      where: { id: event.id },
      data: {
        status: OperationalEventStatus.RESOLVED,
        resolvedAt: new Date(),
        resolvedByUserId: context.user.id,
        resolutionNote,
      },
    });

    await tx.auditLog.create({
      data: {
        workspaceId: context.workspaceId,
        actorUserId: context.user.id,
        action: operationalEventAuditActions.resolved,
        resourceType: eventResourceType,
        resourceId: event.id,
        metadataJson: eventAuditMetadata("Operational event resolved", {
          note: resolutionNote,
        }),
      },
    });

    return updated;
  });
}

export async function reopenOperationalEvent(
  context: AuthenticatedWorkspaceContext,
  eventId: string,
  reason: string,
  client: TriageClient = defaultClient,
) {
  assertCanTriage(context);
  const reopenReason = cleanNote(reason, "reopenReason");
  const event = await getWorkspaceEvent(context, eventId, client);

  if (event.status !== OperationalEventStatus.RESOLVED) {
    throw new EventTriageValidationError({
      status: ["Only resolved events can be reopened."],
    });
  }

  return client.$transaction(async (tx) => {
    const updated = await tx.operationalEvent.update({
      where: { id: event.id },
      data: {
        status: OperationalEventStatus.OPEN,
        acknowledgedAt: null,
        acknowledgedByUserId: null,
        resolvedAt: null,
        resolvedByUserId: null,
        resolutionNote: null,
      },
    });

    await tx.auditLog.create({
      data: {
        workspaceId: context.workspaceId,
        actorUserId: context.user.id,
        action: operationalEventAuditActions.reopened,
        resourceType: eventResourceType,
        resourceId: event.id,
        metadataJson: eventAuditMetadata("Operational event reopened", {
          reason: reopenReason,
        }),
      },
    });

    return updated;
  });
}

export async function createIncidentFromOperationalEvent(
  context: AuthenticatedWorkspaceContext,
  eventId: string,
  client: TriageClient = defaultClient,
): Promise<Incident> {
  assertCanTriage(context);
  const event = await getWorkspaceEvent(context, eventId, client);
  const existing = await client.incident.findFirst({
    where: {
      workspaceId: context.workspaceId,
      sourceEventId: event.id,
    },
  });

  if (existing) {
    throw new DuplicateIncidentError(existing.id);
  }

  try {
    return await client.$transaction(async (tx) => {
      const incident = await tx.incident.create({
        data: {
          workspaceId: context.workspaceId,
          serviceId: event.serviceId,
          sourceEventId: event.id,
          title: incidentTitle(event),
          severity: event.severity as OperationalEventSeverity,
          status: IncidentStatus.OPEN,
          ownerUserId: null,
          startedAt: event.occurredAt,
          summary: incidentSummary(event),
        },
      });

      await tx.auditLog.create({
        data: {
          workspaceId: context.workspaceId,
          actorUserId: context.user.id,
          action: operationalEventAuditActions.incidentCreated,
          resourceType: incidentResourceType,
          resourceId: incident.id,
          metadataJson: {
            summary: "Incident created from operational event",
            sourceEventId: event.id,
            eventSource: event.source,
            severity: incident.severity,
          },
        },
      });

      return incident;
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const duplicate = await client.incident.findFirst({
        where: {
          workspaceId: context.workspaceId,
          sourceEventId: event.id,
        },
      });

      if (duplicate) {
        throw new DuplicateIncidentError(duplicate.id);
      }
    }

    throw error;
  }
}

export async function resolveIncident(
  context: AuthenticatedWorkspaceContext,
  incidentId: string,
  note: string,
  client: TriageClient = defaultClient,
) {
  assertCanTriage(context);
  const resolutionNotes = cleanNote(note, "resolutionNotes");
  const incident = await client.incident.findFirst({
    where: {
      id: incidentId,
      workspaceId: context.workspaceId,
    },
  });

  if (!incident) {
    throw new IncidentNotFoundError();
  }

  if (incident.status === IncidentStatus.RESOLVED) {
    throw new EventTriageValidationError({
      status: ["Incident is already resolved."],
    });
  }

  return client.$transaction(async (tx) => {
    const updated = await tx.incident.update({
      where: { id: incident.id },
      data: {
        status: IncidentStatus.RESOLVED,
        resolvedAt: new Date(),
        resolutionNotes,
      },
    });

    await tx.auditLog.create({
      data: {
        workspaceId: context.workspaceId,
        actorUserId: context.user.id,
        action: operationalEventAuditActions.incidentResolved,
        resourceType: incidentResourceType,
        resourceId: incident.id,
        metadataJson: {
          summary: "Incident resolved",
          note: resolutionNotes,
        },
      },
    });

    return updated;
  });
}
