import {
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

  constructor(readonly services: FakeService[]) {}

  readonly service = {
    findMany: async () => this.services,
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
  });

  it("prevents concurrent duplicate checks with the service lock", async () => {
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
      expect.objectContaining({ checked: 0, skipped: 1 }),
    );
    expect(client.healthChecks).toHaveLength(1);
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
    });
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
