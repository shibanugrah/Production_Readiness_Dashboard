import {
  HealthCheckRunStatus,
  HealthCheckRunTriggerType,
  HealthCheckStatus,
  ServiceEnvironment,
  ServiceStatus,
} from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  HealthCheckRunnerClient,
  runHealthChecks,
} from "@/server/health-checks/runner";

const environment = {
  NODE_ENV: "development",
  APP_VERSION: "local",
  HEALTH_CHECK_LOCAL_ALLOWLIST_ENABLED: "true",
  HEALTH_CHECK_LOCAL_ALLOWED_TARGETS: "localhost:3000",
} as NodeJS.ProcessEnv;

type FakeService = {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  baseUrl: string;
  healthPath: string;
  environment: ServiceEnvironment;
  expectedVersion: string | null;
  status: ServiceStatus;
  isActive: boolean;
  lastCheckedAt: Date | null;
  lastHealthyAt: Date | null;
  checkLockToken: string | null;
  checkLockExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function createFakeService(overrides: Partial<FakeService> = {}): FakeService {
  const now = new Date("2026-06-26T00:00:00.000Z");

  return {
    id: "service_1",
    workspaceId: "workspace_1",
    name: "Demo Service",
    slug: "demo-service",
    baseUrl: "http://localhost:3000",
    healthPath: "/api/demo-service/health",
    environment: ServiceEnvironment.LOCAL,
    expectedVersion: "local-demo",
    status: ServiceStatus.UNKNOWN,
    isActive: true,
    lastCheckedAt: null,
    lastHealthyAt: null,
    checkLockToken: null,
    checkLockExpiresAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

class FakeRunnerClient {
  readonly healthChecks: Array<Record<string, unknown>> = [];
  readonly healthCheckRuns: Array<Record<string, unknown>> = [];
  readonly healthCheckRunLeases = new Map<
    string,
    { workspaceId: string; lockToken: string; expiresAt: Date }
  >();
  private nextRunId = 1;

  constructor(readonly services: FakeService[]) {}

  readonly service = {
    findMany: async ({ where }: { where?: Record<string, unknown> } = {}) =>
      this.services.filter((service) =>
        where?.workspaceId ? service.workspaceId === where.workspaceId : true,
      ),
    updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const matches = this.services.filter((service) =>
        this.matchesServiceWhere(service, where),
      );

      for (const service of matches) {
        Object.assign(service, data, { updatedAt: new Date() });
      }

      return { count: matches.length };
    },
  };

  readonly healthCheck = {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      this.healthChecks.push(data);
      return data;
    },
  };

  readonly healthCheckRun = {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const run = {
        id: `run_${this.nextRunId}`,
        ...data,
        startedAt: new Date(),
        finishedAt: null,
        checkedCount: 0,
        healthyCount: 0,
        degradedCount: 0,
        downCount: 0,
        skippedCount: 0,
        errorCount: 0,
        errorMessage: null,
      };

      this.nextRunId += 1;
      this.healthCheckRuns.push(run);
      return run;
    },
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => {
      const run = this.healthCheckRuns.find((candidate) => candidate.id === where.id);

      if (!run) {
        throw new Error("run not found");
      }

      Object.assign(run, data);
      return run;
    },
  };

  readonly healthCheckRunLease = {
    create: async ({
      data,
    }: {
      data: { workspaceId: string; lockToken: string; expiresAt: Date };
    }) => {
      if (this.healthCheckRunLeases.has(data.workspaceId)) {
        throw { code: "P2002" };
      }

      this.healthCheckRunLeases.set(data.workspaceId, data);
      return data;
    },
    updateMany: async ({
      where,
      data,
    }: {
      where: { workspaceId: string; expiresAt: { lt: Date } };
      data: { lockToken: string; expiresAt: Date };
    }) => {
      const lease = this.healthCheckRunLeases.get(where.workspaceId);

      if (!lease || !(lease.expiresAt < where.expiresAt.lt)) {
        return { count: 0 };
      }

      this.healthCheckRunLeases.set(where.workspaceId, {
        workspaceId: where.workspaceId,
        lockToken: data.lockToken,
        expiresAt: data.expiresAt,
      });

      return { count: 1 };
    },
    deleteMany: async ({
      where,
    }: {
      where: { workspaceId: string; lockToken: string };
    }) => {
      const lease = this.healthCheckRunLeases.get(where.workspaceId);

      if (!lease || lease.lockToken !== where.lockToken) {
        return { count: 0 };
      }

      this.healthCheckRunLeases.delete(where.workspaceId);
      return { count: 1 };
    },
  };

  async $transaction<T>(operations: Array<Promise<T>>) {
    return Promise.all(operations);
  }

  asClient() {
    return this as unknown as HealthCheckRunnerClient;
  }

  private matchesServiceWhere(service: FakeService, where: Record<string, unknown>) {
    if (where.id && service.id !== where.id) {
      return false;
    }

    if (where.workspaceId && service.workspaceId !== where.workspaceId) {
      return false;
    }

    if (where.isActive !== undefined && service.isActive !== where.isActive) {
      return false;
    }

    if (
      where.checkLockToken !== undefined &&
      service.checkLockToken !== where.checkLockToken
    ) {
      return false;
    }

    const lockClauses = where.OR as
      | Array<{ checkLockExpiresAt: null | { lt: Date } }>
      | undefined;

    if (lockClauses) {
      const lockMatches = lockClauses.some((clause) => {
        if (clause.checkLockExpiresAt === null) {
          return service.checkLockExpiresAt === null;
        }

        return (
          service.checkLockExpiresAt !== null &&
          service.checkLockExpiresAt < clause.checkLockExpiresAt.lt
        );
      });

      if (!lockMatches) {
        return false;
      }
    }

    return true;
  }
}

describe("health check runner persistence and locking", () => {
  it("skips inactive services without creating health check rows", async () => {
    const client = new FakeRunnerClient([
      createFakeService({ isActive: false }),
    ]);

    await expect(
      runHealthChecks(client.asClient(), {
        environment,
        fetchImpl: async () => new Response('{"status":"ok"}'),
      }),
    ).resolves.toMatchObject({ checked: 0, skipped: 1 });
    expect(client.healthChecks).toHaveLength(0);
    expect(client.healthCheckRuns[0]).toMatchObject({
      status: HealthCheckRunStatus.COMPLETED,
      skippedCount: 1,
    });
  });

  it("creates a manual HealthCheckRun with the requester identity", async () => {
    const client = new FakeRunnerClient([createFakeService()]);

    const summary = await runHealthChecks(client.asClient(), {
      environment,
      workspaceId: "workspace_1",
      triggerType: HealthCheckRunTriggerType.MANUAL,
      requestedByUserId: "user_owner",
      fetchImpl: async () =>
        new Response(JSON.stringify({ status: "ok", version: "local-demo" })),
    });

    expect(summary).toMatchObject({
      checked: 1,
      healthy: 1,
      triggerType: HealthCheckRunTriggerType.MANUAL,
      status: HealthCheckRunStatus.COMPLETED,
    });
    expect(client.healthCheckRuns[0]).toMatchObject({
      workspaceId: "workspace_1",
      triggerType: HealthCheckRunTriggerType.MANUAL,
      requestedByUserId: "user_owner",
      status: HealthCheckRunStatus.COMPLETED,
      checkedCount: 1,
      healthyCount: 1,
    });
    expect(client.healthChecks[0]).toMatchObject({
      runId: client.healthCheckRuns[0].id,
    });
  });

  it("prevents concurrent duplicate runs with the workspace lease", async () => {
    const client = new FakeRunnerClient([createFakeService()]);
    const fetchImpl = async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return new Response(
        JSON.stringify({ status: "ok", version: "local-demo" }),
        { status: 200 },
      );
    };

    const summaries = await Promise.all([
      runHealthChecks(client.asClient(), { environment, fetchImpl }),
      runHealthChecks(client.asClient(), { environment, fetchImpl }),
    ]);

    expect(summaries).toContainEqual(
      expect.objectContaining({ checked: 1, skipped: 0 }),
    );
    expect(summaries).toContainEqual(
      expect.objectContaining({
        checked: 0,
        status: HealthCheckRunStatus.SKIPPED,
      }),
    );
    expect(client.healthChecks).toHaveLength(1);
    expect(client.healthCheckRuns).toHaveLength(2);
    expect(
      client.healthCheckRuns.filter(
        (run) => run.status === HealthCheckRunStatus.SKIPPED,
      ),
    ).toHaveLength(1);
  });

  it("still skips a service when its per-service lock is active", async () => {
    const client = new FakeRunnerClient([
      createFakeService({
        checkLockToken: "active-lock",
        checkLockExpiresAt: new Date(Date.now() + 60_000),
      }),
    ]);

    const summary = await runHealthChecks(client.asClient(), {
      environment,
      fetchImpl: async () =>
        new Response(JSON.stringify({ status: "ok", version: "local-demo" })),
    });

    expect(summary).toMatchObject({
      checked: 0,
      skipped: 1,
      status: HealthCheckRunStatus.COMPLETED,
    });
    expect(client.healthChecks).toHaveLength(0);
    expect(client.healthCheckRuns[0]).toMatchObject({
      status: HealthCheckRunStatus.COMPLETED,
      skippedCount: 1,
    });
  });

  it("persists network failure evidence", async () => {
    const service = createFakeService();
    const client = new FakeRunnerClient([service]);

    const summary = await runHealthChecks(client.asClient(), {
      environment,
      fetchImpl: async () => {
        throw new Error("connect ECONNREFUSED");
      },
    });

    expect(summary).toMatchObject({ checked: 1, down: 1, errors: 0 });
    expect(service.status).toBe(ServiceStatus.DOWN);
    expect(client.healthChecks[0]).toMatchObject({
      status: HealthCheckStatus.FAILURE,
      httpStatus: null,
      message: "connect ECONNREFUSED",
      runId: client.healthCheckRuns[0].id,
    });
    expect(client.healthCheckRuns[0]).toMatchObject({
      status: HealthCheckRunStatus.COMPLETED,
      checkedCount: 1,
      downCount: 1,
    });
  });

  it("updates lastHealthyAt for degraded checks with a valid ok payload", async () => {
    const service = createFakeService({ expectedVersion: "expected-version" });
    const client = new FakeRunnerClient([service]);

    const summary = await runHealthChecks(client.asClient(), {
      environment,
      fetchImpl: async () =>
        new Response(
          JSON.stringify({ status: "ok", version: "different-version" }),
          { status: 200 },
        ),
    });

    expect(summary).toMatchObject({ checked: 1, degraded: 1 });
    expect(service.status).toBe(ServiceStatus.DEGRADED);
    expect(service.lastCheckedAt).toBeInstanceOf(Date);
    expect(service.lastHealthyAt).toBeInstanceOf(Date);
    expect(client.healthChecks[0]).toMatchObject({
      status: HealthCheckStatus.DEGRADED,
      observedVersion: "different-version",
      runId: client.healthCheckRuns[0].id,
    });
    expect(client.healthCheckRuns[0]).toMatchObject({
      checkedCount: 1,
      degradedCount: 1,
    });
  });

  it("continues checking remaining services after one service failure", async () => {
    const downService = createFakeService({
      id: "service_1",
    });
    const healthyService = createFakeService({
      id: "service_2",
      name: "Healthy Service",
      slug: "healthy-service",
    });
    const client = new FakeRunnerClient([downService, healthyService]);
    let calls = 0;

    const summary = await runHealthChecks(client.asClient(), {
      environment,
      fetchImpl: async () => {
        calls += 1;

        if (calls === 1) {
          throw new Error("connect ECONNREFUSED");
        }

        return new Response(
          JSON.stringify({ status: "ok", version: "local-demo" }),
        );
      },
    });

    expect(summary).toMatchObject({
      checked: 2,
      healthy: 1,
      down: 1,
      errors: 0,
      status: HealthCheckRunStatus.COMPLETED,
    });
    expect(client.healthChecks).toHaveLength(2);
    expect(client.healthChecks[0]).toMatchObject({
      serviceId: "service_1",
      status: HealthCheckStatus.FAILURE,
      runId: client.healthCheckRuns[0].id,
    });
    expect(client.healthChecks[1]).toMatchObject({
      serviceId: "service_2",
      status: HealthCheckStatus.SUCCESS,
      runId: client.healthCheckRuns[0].id,
    });
    expect(client.healthCheckRuns[0]).toMatchObject({
      checkedCount: 2,
      healthyCount: 1,
      downCount: 1,
      errorCount: 0,
    });
  });

  it("marks the parent run failed when an unexpected runner failure occurs", async () => {
    const client = new FakeRunnerClient([]);
    client.service.findMany = async () => {
      throw new Error("database unavailable");
    };

    await expect(
      runHealthChecks(client.asClient(), {
        environment,
        workspaceId: "workspace_1",
      }),
    ).rejects.toThrow("database unavailable");

    expect(client.healthCheckRuns[0]).toMatchObject({
      status: HealthCheckRunStatus.FAILED,
      errorMessage: "database unavailable",
    });
  });

  it("marks the parent run failed when workspace lease acquisition fails unexpectedly", async () => {
    const client = new FakeRunnerClient([createFakeService()]);
    client.healthCheckRunLease.create = async () => {
      throw new Error("lease store unavailable");
    };

    await expect(
      runHealthChecks(client.asClient(), {
        environment,
        workspaceId: "workspace_1",
      }),
    ).rejects.toThrow("lease store unavailable");

    expect(client.healthCheckRuns[0]).toMatchObject({
      status: HealthCheckRunStatus.FAILED,
      errorMessage: "lease store unavailable",
    });
    expect(client.healthChecks).toHaveLength(0);
  });

  it("recovers automatically from an expired workspace lease", async () => {
    const client = new FakeRunnerClient([createFakeService()]);
    client.healthCheckRunLeases.set("workspace_1", {
      workspaceId: "workspace_1",
      lockToken: "expired-lock",
      expiresAt: new Date(Date.now() - 60_000),
    });

    const summary = await runHealthChecks(client.asClient(), {
      environment,
      fetchImpl: async () =>
        new Response(JSON.stringify({ status: "ok", version: "local-demo" })),
    });

    expect(summary).toMatchObject({
      checked: 1,
      healthy: 1,
      status: HealthCheckRunStatus.COMPLETED,
    });
    expect(client.healthChecks).toHaveLength(1);
    expect(client.healthCheckRunLeases.size).toBe(0);
  });

  it("preserves failed history after later recovery", async () => {
    const service = createFakeService();
    const client = new FakeRunnerClient([service]);
    const responses = [
      new Response(JSON.stringify({ status: "error" }), { status: 503 }),
      new Response(
        JSON.stringify({ status: "ok", version: "local-demo" }),
        { status: 200 },
      ),
    ];

    await runHealthChecks(client.asClient(), {
      environment,
      fetchImpl: async () => responses.shift() ?? new Response("{}"),
    });
    await runHealthChecks(client.asClient(), {
      environment,
      fetchImpl: async () => responses.shift() ?? new Response("{}"),
    });

    expect(client.healthChecks).toHaveLength(2);
    expect(client.healthChecks[0]).toMatchObject({
      status: HealthCheckStatus.FAILURE,
    });
    expect(client.healthChecks[1]).toMatchObject({
      status: HealthCheckStatus.SUCCESS,
    });
    expect(service.status).toBe(ServiceStatus.HEALTHY);
    expect(service.lastHealthyAt).toBeInstanceOf(Date);
  });
});
