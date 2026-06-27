import {
  OperationalEventSeverity,
  OperationalEventStatus,
  OperationalEventType,
  ServiceEnvironment,
  ServiceStatus,
  WorkspaceRole,
} from "@prisma/client";
import { describe, expect, it } from "vitest";

import { AuthenticatedWorkspaceContext } from "@/server/auth/context";
import { PermissionDeniedError } from "@/server/auth/permissions";
import {
  createOperationalEventIngestKey,
  eventIngestKeyAuditActions,
  parseEventIngestToken,
  revokeOperationalEventIngestKey,
} from "@/server/operational-events/ingest-keys";
import {
  EventIngestionAuthError,
  EventIngestionConflictError,
  EventIngestionValidationError,
  authenticateOperationalEventIngestKey,
  ingestOperationalEvent,
} from "@/server/operational-events/ingestion";

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

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    type: OperationalEventType.JOB,
    severity: OperationalEventSeverity.ERROR,
    idempotencyKey: "job-123",
    occurredAt: "2026-06-27T00:00:00.000Z",
    serviceId: "service_1",
    externalReference: "job/run/123",
    errorMessage: "Job failed after extraction.",
    payload: { jobId: "123", attempts: 1 },
    ...overrides,
  };
}

class FakeOperationalEventClient {
  private nextKeyId = 1;
  private nextEventId = 1;
  readonly operationalEventIngestKeys: Array<Record<string, unknown>> = [];
  readonly operationalEvents: Array<Record<string, unknown>> = [];
  readonly auditLogs: Array<Record<string, unknown>> = [];
  readonly services = [
    {
      id: "service_1",
      workspaceId: "workspace_1",
      name: "Demo Service",
      slug: "demo-service",
      baseUrl: "https://demo.example.test",
      healthPath: "/health",
      environment: ServiceEnvironment.STAGING,
      expectedVersion: null,
      status: ServiceStatus.UNKNOWN,
      isActive: true,
      lastCheckedAt: null,
      lastHealthyAt: null,
      checkLockToken: null,
      checkLockExpiresAt: null,
      createdAt: new Date("2026-06-27T00:00:00.000Z"),
      updatedAt: new Date("2026-06-27T00:00:00.000Z"),
    },
    {
      id: "service_other",
      workspaceId: "workspace_2",
      name: "Other Service",
      slug: "other-service",
      baseUrl: "https://other.example.test",
      healthPath: "/health",
      environment: ServiceEnvironment.STAGING,
      expectedVersion: null,
      status: ServiceStatus.UNKNOWN,
      isActive: true,
      lastCheckedAt: null,
      lastHealthyAt: null,
      checkLockToken: null,
      checkLockExpiresAt: null,
      createdAt: new Date("2026-06-27T00:00:00.000Z"),
      updatedAt: new Date("2026-06-27T00:00:00.000Z"),
    },
  ];

  readonly operationalEventIngestKey = {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const key = {
        id: `key_${this.nextKeyId++}`,
        isActive: true,
        lastUsedAt: null,
        revokedAt: null,
        createdAt: new Date("2026-06-27T00:00:00.000Z"),
        updatedAt: new Date("2026-06-27T00:00:00.000Z"),
        ...data,
      };
      this.operationalEventIngestKeys.push(key);
      return key;
    },
    findFirst: async ({ where }: { where: Record<string, unknown> }) =>
      this.operationalEventIngestKeys.find((key) =>
        Object.entries(where).every(([field, value]) => key[field] === value),
      ) ?? null,
    findUnique: async ({ where }: { where: { lookupId?: string; id?: string } }) =>
      this.operationalEventIngestKeys.find((key) =>
        where.lookupId ? key.lookupId === where.lookupId : key.id === where.id,
      ) ?? null,
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => {
      const key = this.operationalEventIngestKeys.find(
        (candidate) => candidate.id === where.id,
      );

      if (!key) {
        throw new Error("key not found");
      }

      Object.assign(key, data, { updatedAt: new Date() });
      return key;
    },
  };

  readonly auditLog = {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      this.auditLogs.push(data);
      return data;
    },
  };

  readonly service = {
    findFirst: async ({
      where,
    }: {
      where: { id: string; workspaceId: string };
    }) =>
      this.services.find(
        (service) =>
          service.id === where.id && service.workspaceId === where.workspaceId,
      ) ?? null,
  };

  readonly operationalEvent = {
    findFirst: async ({ where }: { where: Record<string, unknown> }) =>
      this.operationalEvents.find((event) =>
        Object.entries(where).every(([field, value]) => event[field] === value),
      ) ?? null,
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const event = {
        id: `event_${this.nextEventId++}`,
        createdAt: new Date("2026-06-27T00:00:00.000Z"),
        ...data,
      };
      this.operationalEvents.push(event);
      return event;
    },
  };

  async $transaction<T>(callback: (tx: this) => Promise<T>) {
    return callback(this);
  }
}

function requestWithToken(token?: string) {
  const headers = new Headers();

  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }

  return new Request("http://localhost/api/internal/operational-events", {
    method: "POST",
    headers,
  });
}

describe("operational event ingestion keys", () => {
  it("allows Owners to create and revoke keys with audit records and one-time raw secret", async () => {
    const client = new FakeOperationalEventClient();
    const created = await createOperationalEventIngestKey(
      context(WorkspaceRole.OWNER),
      { name: "Local Demo", source: "local-demo" },
      client as never,
    );

    expect(created.token).toMatch(/^prd_evt_/);
    expect(created.metadata).not.toHaveProperty("secretHash");
    expect(client.operationalEventIngestKeys[0]).toHaveProperty("secretHash");
    expect(client.auditLogs[0]).toMatchObject({
      action: eventIngestKeyAuditActions.created,
      workspaceId: "workspace_1",
    });
    expect(JSON.stringify(client.auditLogs[0])).not.toContain(created.token);

    await revokeOperationalEventIngestKey(
      context(WorkspaceRole.OWNER),
      String(created.metadata.id),
      client as never,
    );

    expect(client.operationalEventIngestKeys[0]).toMatchObject({
      isActive: false,
    });
    expect(client.auditLogs[1]).toMatchObject({
      action: eventIngestKeyAuditActions.revoked,
    });
    expect(JSON.stringify(client.auditLogs[1])).not.toContain(created.token);
  });

  it.each([WorkspaceRole.ADMIN, WorkspaceRole.VIEWER])(
    "denies %s key management",
    async (role) => {
      const client = new FakeOperationalEventClient();

      await expect(
        createOperationalEventIngestKey(
          context(role),
          { name: "Local Demo", source: "local-demo" },
          client as never,
        ),
      ).rejects.toThrow(PermissionDeniedError);
      await expect(
        revokeOperationalEventIngestKey(context(role), "key_1", client as never),
      ).rejects.toThrow(PermissionDeniedError);
      expect(client.auditLogs).toHaveLength(0);
    },
  );
});

describe("operational event ingestion", () => {
  it("creates workspace-scoped events with a valid key", async () => {
    const client = new FakeOperationalEventClient();
    const created = await createOperationalEventIngestKey(
      context(WorkspaceRole.OWNER),
      { name: "Local Demo", source: "local-demo" },
      client as never,
    );
    const authenticated = await authenticateOperationalEventIngestKey(
      requestWithToken(created.token),
      client as never,
    );
    const result = await ingestOperationalEvent(
      authenticated,
      validPayload(),
      client as never,
    );

    expect(result.replayed).toBe(false);
    expect(result.event).toMatchObject({
      workspaceId: "workspace_1",
      source: "local-demo",
      serviceId: "service_1",
      status: OperationalEventStatus.OPEN,
    });
    expect(client.operationalEvents).toHaveLength(1);
    expect(client.operationalEventIngestKeys[0].lastUsedAt).toBeInstanceOf(Date);
  });

  it("rejects request bodies that try to provide workspace or source authority", async () => {
    const client = new FakeOperationalEventClient();
    const created = await createOperationalEventIngestKey(
      context(WorkspaceRole.OWNER),
      { name: "Local Demo", source: "local-demo" },
      client as never,
    );
    const authenticated = await authenticateOperationalEventIngestKey(
      requestWithToken(created.token),
      client as never,
    );

    await expect(
      ingestOperationalEvent(
        authenticated,
        validPayload({ workspaceId: "workspace_other", source: "forged" }),
        client as never,
      ),
    ).rejects.toThrow(EventIngestionValidationError);
    expect(client.operationalEvents).toHaveLength(0);
  });

  it("denies missing, malformed, invalid, inactive, and revoked keys", async () => {
    const client = new FakeOperationalEventClient();
    const created = await createOperationalEventIngestKey(
      context(WorkspaceRole.OWNER),
      { name: "Local Demo", source: "local-demo" },
      client as never,
    );
    const token = parseEventIngestToken(created.token);

    await expect(
      authenticateOperationalEventIngestKey(requestWithToken(), client as never),
    ).rejects.toMatchObject({ status: 401 });
    await expect(
      authenticateOperationalEventIngestKey(
        requestWithToken("not-a-real-token"),
        client as never,
      ),
    ).rejects.toMatchObject({ status: 401 });
    await expect(
      authenticateOperationalEventIngestKey(
        requestWithToken(`prd_evt_${token?.lookupId}.wrongsecretwrongsecretwrongsecretwrongsecret`),
        client as never,
      ),
    ).rejects.toThrow(EventIngestionAuthError);

    client.operationalEventIngestKeys[0].isActive = false;
    await expect(
      authenticateOperationalEventIngestKey(requestWithToken(created.token), client as never),
    ).rejects.toMatchObject({ status: 403 });

    client.operationalEventIngestKeys[0].isActive = true;
    client.operationalEventIngestKeys[0].revokedAt = new Date();
    await expect(
      authenticateOperationalEventIngestKey(requestWithToken(created.token), client as never),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("rejects a service id from another workspace", async () => {
    const client = new FakeOperationalEventClient();
    const created = await createOperationalEventIngestKey(
      context(WorkspaceRole.OWNER),
      { name: "Local Demo", source: "local-demo" },
      client as never,
    );
    const authenticated = await authenticateOperationalEventIngestKey(
      requestWithToken(created.token),
      client as never,
    );

    await expect(
      ingestOperationalEvent(
        authenticated,
        validPayload({ serviceId: "service_other" }),
        client as never,
      ),
    ).rejects.toThrow(EventIngestionValidationError);
    expect(client.operationalEvents).toHaveLength(0);
  });

  it("returns the existing event for valid idempotent replay", async () => {
    const client = new FakeOperationalEventClient();
    const created = await createOperationalEventIngestKey(
      context(WorkspaceRole.OWNER),
      { name: "Local Demo", source: "local-demo" },
      client as never,
    );
    const authenticated = await authenticateOperationalEventIngestKey(
      requestWithToken(created.token),
      client as never,
    );
    const first = await ingestOperationalEvent(
      authenticated,
      validPayload(),
      client as never,
    );
    const second = await ingestOperationalEvent(
      authenticated,
      validPayload(),
      client as never,
    );

    expect(second.replayed).toBe(true);
    expect(second.event.id).toBe(first.event.id);
    expect(client.operationalEvents).toHaveLength(1);
  });

  it("returns conflict for idempotency reuse with different content", async () => {
    const client = new FakeOperationalEventClient();
    const created = await createOperationalEventIngestKey(
      context(WorkspaceRole.OWNER),
      { name: "Local Demo", source: "local-demo" },
      client as never,
    );
    const authenticated = await authenticateOperationalEventIngestKey(
      requestWithToken(created.token),
      client as never,
    );

    await ingestOperationalEvent(authenticated, validPayload(), client as never);
    await expect(
      ingestOperationalEvent(
        authenticated,
        validPayload({ errorMessage: "Different failure" }),
        client as never,
      ),
    ).rejects.toThrow(EventIngestionConflictError);
    expect(client.operationalEvents).toHaveLength(1);
  });

  it("rejects sensitive and oversized payloads", async () => {
    const client = new FakeOperationalEventClient();
    const created = await createOperationalEventIngestKey(
      context(WorkspaceRole.OWNER),
      { name: "Local Demo", source: "local-demo" },
      client as never,
    );
    const authenticated = await authenticateOperationalEventIngestKey(
      requestWithToken(created.token),
      client as never,
    );

    await expect(
      ingestOperationalEvent(
        authenticated,
        validPayload({ payload: { authorization: "Bearer secret" } }),
        client as never,
      ),
    ).rejects.toThrow(EventIngestionValidationError);
    await expect(
      ingestOperationalEvent(
        authenticated,
        validPayload({ payload: { value: "x".repeat(20_000) } }),
        client as never,
      ),
    ).rejects.toThrow(EventIngestionValidationError);
  });
});
