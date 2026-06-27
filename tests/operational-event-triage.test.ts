import {
  IncidentStatus,
  OperationalEventSeverity,
  OperationalEventStatus,
  OperationalEventType,
  WorkspaceRole,
} from "@prisma/client";
import { describe, expect, it } from "vitest";

import { AuthenticatedWorkspaceContext } from "@/server/auth/context";
import { PermissionDeniedError } from "@/server/auth/permissions";
import {
  DuplicateIncidentError,
  EventTriageNotFoundError,
  EventTriageValidationError,
  acknowledgeOperationalEvent,
  createIncidentFromOperationalEvent,
  operationalEventAuditActions,
  reopenOperationalEvent,
  resolveIncident,
  resolveOperationalEvent,
} from "@/server/operational-events/triage";

function context(
  role: WorkspaceRole,
  workspaceId = "workspace_1",
): AuthenticatedWorkspaceContext {
  return {
    workspaceId,
    userId: "user_1",
    role,
    user: {
      id: "user_1",
      name: "Demo User",
      email: "demo@example.local",
    },
    workspace: {
      id: workspaceId,
      name: "Portfolio Operations",
      slug: "portfolio-operations",
    },
  };
}

function eventFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "event_1",
    workspaceId: "workspace_1",
    serviceId: "service_1",
    source: "local-demo",
    type: OperationalEventType.JOB,
    severity: OperationalEventSeverity.ERROR,
    status: OperationalEventStatus.OPEN,
    message: "Job failed",
    externalReference: "job/1",
    errorMessage: "Extractor failed",
    metadata: { jobId: "1" },
    payloadHash: "immutable-hash",
    idempotencyKey: "job-1",
    acknowledgedAt: null,
    acknowledgedByUserId: null,
    resolvedAt: null,
    resolvedByUserId: null,
    resolutionNote: null,
    occurredAt: new Date("2026-06-27T00:00:00.000Z"),
    createdAt: new Date("2026-06-27T00:00:01.000Z"),
    updatedAt: new Date("2026-06-27T00:00:01.000Z"),
    ...overrides,
  };
}

class FakeTriageClient {
  private nextIncidentId = 1;
  readonly operationalEvents: Array<Record<string, unknown>> = [eventFixture()];
  readonly incidents: Array<Record<string, unknown>> = [];
  readonly auditLogs: Array<Record<string, unknown>> = [];

  readonly operationalEvent = {
    findFirst: async ({ where }: { where: Record<string, unknown> }) =>
      this.operationalEvents.find((event) =>
        Object.entries(where).every(([field, value]) => event[field] === value),
      ) ?? null,
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => {
      const event = this.operationalEvents.find(
        (candidate) => candidate.id === where.id,
      );

      if (!event) {
        throw new Error("event not found");
      }

      Object.assign(event, data, { updatedAt: new Date() });
      return event;
    },
  };

  readonly incident = {
    findFirst: async ({ where }: { where: Record<string, unknown> }) =>
      this.incidents.find((incident) =>
        Object.entries(where).every(([field, value]) => incident[field] === value),
      ) ?? null,
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const incident = {
        id: `incident_${this.nextIncidentId++}`,
        status: IncidentStatus.OPEN,
        resolvedAt: null,
        resolutionNotes: null,
        createdAt: new Date("2026-06-27T00:00:02.000Z"),
        updatedAt: new Date("2026-06-27T00:00:02.000Z"),
        ...data,
      };
      this.incidents.push(incident);
      return incident;
    },
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => {
      const incident = this.incidents.find(
        (candidate) => candidate.id === where.id,
      );

      if (!incident) {
        throw new Error("incident not found");
      }

      Object.assign(incident, data, { updatedAt: new Date() });
      return incident;
    },
  };

  readonly auditLog = {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      this.auditLogs.push(data);
      return data;
    },
  };

  async $transaction<T>(callback: (tx: this) => Promise<T>) {
    return callback(this);
  }
}

describe("operational event triage", () => {
  it.each([WorkspaceRole.OWNER, WorkspaceRole.ADMIN])(
    "%s can acknowledge, resolve, and reopen events with audit evidence",
    async (role) => {
      const client = new FakeTriageClient();
      const actor = context(role);

      await acknowledgeOperationalEvent(actor, "event_1", client as never);
      expect(client.operationalEvents[0]).toMatchObject({
        status: OperationalEventStatus.ACKNOWLEDGED,
        acknowledgedByUserId: "user_1",
      });

      await resolveOperationalEvent(
        actor,
        "event_1",
        "The upstream job recovered.",
        client as never,
      );
      expect(client.operationalEvents[0]).toMatchObject({
        status: OperationalEventStatus.RESOLVED,
        resolvedByUserId: "user_1",
        resolutionNote: "The upstream job recovered.",
        payloadHash: "immutable-hash",
        source: "local-demo",
      });

      await reopenOperationalEvent(
        actor,
        "event_1",
        "The failure returned.",
        client as never,
      );
      expect(client.operationalEvents[0]).toMatchObject({
        status: OperationalEventStatus.OPEN,
        acknowledgedAt: null,
        acknowledgedByUserId: null,
        resolvedAt: null,
        resolvedByUserId: null,
        resolutionNote: null,
        payloadHash: "immutable-hash",
      });
      expect(client.auditLogs.map((entry) => entry.action)).toEqual([
        operationalEventAuditActions.acknowledged,
        operationalEventAuditActions.resolved,
        operationalEventAuditActions.reopened,
      ]);
    },
  );

  it("denies Viewer triage without audit records", async () => {
    const client = new FakeTriageClient();

    await expect(
      acknowledgeOperationalEvent(
        context(WorkspaceRole.VIEWER),
        "event_1",
        client as never,
      ),
    ).rejects.toThrow(PermissionDeniedError);
    expect(client.auditLogs).toHaveLength(0);
  });

  it("returns not found for cross-workspace event triage", async () => {
    const client = new FakeTriageClient();

    await expect(
      acknowledgeOperationalEvent(
        context(WorkspaceRole.OWNER, "workspace_2"),
        "event_1",
        client as never,
      ),
    ).rejects.toThrow(EventTriageNotFoundError);
    expect(client.auditLogs).toHaveLength(0);
  });

  it("validates resolution and reopen notes without audit records", async () => {
    const client = new FakeTriageClient();

    await expect(
      resolveOperationalEvent(
        context(WorkspaceRole.OWNER),
        "event_1",
        " ",
        client as never,
      ),
    ).rejects.toThrow(EventTriageValidationError);
    expect(client.auditLogs).toHaveLength(0);

    client.operationalEvents[0].status = OperationalEventStatus.RESOLVED;
    await expect(
      reopenOperationalEvent(
        context(WorkspaceRole.OWNER),
        "event_1",
        "x".repeat(501),
        client as never,
      ),
    ).rejects.toThrow(EventTriageValidationError);
    expect(client.auditLogs).toHaveLength(0);
  });

  it("creates one incident from an event and prevents duplicates", async () => {
    const client = new FakeTriageClient();
    const incident = await createIncidentFromOperationalEvent(
      context(WorkspaceRole.ADMIN),
      "event_1",
      client as never,
    );

    expect(incident).toMatchObject({
      workspaceId: "workspace_1",
      sourceEventId: "event_1",
      serviceId: "service_1",
      status: IncidentStatus.OPEN,
      ownerUserId: null,
    });
    expect(client.operationalEvents[0]).toMatchObject({
      status: OperationalEventStatus.OPEN,
      payloadHash: "immutable-hash",
    });
    expect(client.auditLogs[0]).toMatchObject({
      action: operationalEventAuditActions.incidentCreated,
      resourceType: "INCIDENT",
      resourceId: "incident_1",
    });

    await expect(
      createIncidentFromOperationalEvent(
        context(WorkspaceRole.OWNER),
        "event_1",
        client as never,
      ),
    ).rejects.toThrow(DuplicateIncidentError);
    expect(client.incidents).toHaveLength(1);
  });

  it("resolves incidents with audit evidence", async () => {
    const client = new FakeTriageClient();
    const incident = await createIncidentFromOperationalEvent(
      context(WorkspaceRole.OWNER),
      "event_1",
      client as never,
    );

    await resolveIncident(
      context(WorkspaceRole.OWNER),
      incident.id,
      "Operator confirmed recovery.",
      client as never,
    );

    expect(client.incidents[0]).toMatchObject({
      status: IncidentStatus.RESOLVED,
      resolutionNotes: "Operator confirmed recovery.",
    });
    expect(client.auditLogs.map((entry) => entry.action)).toEqual([
      operationalEventAuditActions.incidentCreated,
      operationalEventAuditActions.incidentResolved,
    ]);
  });
});
