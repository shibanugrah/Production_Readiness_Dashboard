import {
  Service,
  ServiceEnvironment,
  ServiceStatus,
  WorkspaceRole,
} from "@prisma/client";
import { describe, expect, it } from "vitest";

import { AuthenticatedWorkspaceContext } from "@/server/auth/context";
import { PermissionDeniedError } from "@/server/auth/permissions";
import {
  ServiceManagementClient,
  ServiceManagementTransactionClient,
  ServiceMutationValidationError,
  ServiceNotFoundError,
  createManagedService,
  deactivateManagedService,
  reactivateManagedService,
  serviceAuditActions,
  updateManagedService,
} from "@/server/services/management";

const validInput = {
  name: "Payments API",
  slug: "payments-api",
  baseUrl: "https://payments.example.test",
  healthPath: "/health",
  environment: ServiceEnvironment.STAGING,
  expectedVersion: "2026.06",
};

const publicResolver = async () => [{ address: "93.184.216.34", family: 4 }];

function context(role: WorkspaceRole, workspaceId = "workspace_1"): AuthenticatedWorkspaceContext {
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

class FakeManagementClient implements ServiceManagementClient {
  private nextId = 1;
  readonly services: Service[] = [];
  readonly auditLogs: Array<Record<string, unknown>> = [];

  readonly service = {
    findFirst: async (args: Parameters<ServiceManagementClient["service"]["findFirst"]>[0]) =>
      this.services.find((service) => this.matchesWhere(service, args.where)) ??
      null,
    create: async (
      args: Parameters<
        ServiceManagementTransactionClient["service"]["create"]
      >[0],
    ) => this.insertService(args.data),
    updateMany: async (
      args: Parameters<
        ServiceManagementTransactionClient["service"]["updateMany"]
      >[0],
    ) => {
      const matches = this.services.filter((service) =>
        this.matchesWhere(service, args.where),
      );

      for (const service of matches) {
        for (const [key, value] of Object.entries(args.data)) {
          if (value !== undefined) {
            Reflect.set(service, key, value);
          }
        }

        service.updatedAt = new Date();
      }

      return { count: matches.length };
    },
  };

  readonly auditLog = {
    create: async ({
      data,
    }: Parameters<
      ServiceManagementTransactionClient["auditLog"]["create"]
    >[0]) => {
      this.auditLogs.push(data);
      return data;
    },
  };

  async $transaction<T>(
    callback: (tx: ServiceManagementTransactionClient) => Promise<T>,
  ): Promise<T> {
    return callback(this);
  }

  seedService(input: Partial<Service> = {}) {
    return this.insertService({
      workspaceId: input.workspaceId ?? "workspace_1",
      name: input.name ?? "Existing API",
      slug: input.slug ?? "existing-api",
      baseUrl: input.baseUrl ?? "https://existing.example.test",
      healthPath: input.healthPath ?? "/health",
      environment: input.environment ?? ServiceEnvironment.STAGING,
      expectedVersion: input.expectedVersion ?? null,
      status: input.status ?? ServiceStatus.UNKNOWN,
      isActive: input.isActive ?? true,
    });
  }

  private insertService(
    input: {
      workspaceId: string;
      name: string;
      slug: string;
      baseUrl: string;
      healthPath: string;
      environment: ServiceEnvironment;
      expectedVersion: string | null;
      status: ServiceStatus;
      isActive?: boolean;
    },
  ) {
    const now = new Date("2026-06-27T00:00:00.000Z");
    const service: Service = {
      id: `service_${this.nextId++}`,
      workspaceId: input.workspaceId,
      name: input.name,
      slug: input.slug,
      baseUrl: input.baseUrl,
      healthPath: input.healthPath,
      environment: input.environment,
      expectedVersion: input.expectedVersion,
      status: input.status,
      isActive: input.isActive ?? true,
      lastCheckedAt: null,
      lastHealthyAt: null,
      checkLockToken: null,
      checkLockExpiresAt: null,
      createdAt: now,
      updatedAt: now,
    };

    this.services.push(service);
    return service;
  }

  private matchesWhere(
    service: Service,
    where: {
      id?: string;
      workspaceId?: string;
      slug?: string;
      NOT?: { id: string };
      isActive?: boolean;
    },
  ) {
    if (where.id && service.id !== where.id) {
      return false;
    }

    if (where.workspaceId && service.workspaceId !== where.workspaceId) {
      return false;
    }

    if (where.slug && service.slug !== where.slug) {
      return false;
    }

    if (where.NOT?.id && service.id === where.NOT.id) {
      return false;
    }

    if (where.isActive !== undefined && service.isActive !== where.isActive) {
      return false;
    }

    return true;
  }
}

describe("audited service management", () => {
  it.each([WorkspaceRole.OWNER, WorkspaceRole.ADMIN])(
    "%s can create, update, deactivate, and reactivate with one audit row per mutation",
    async (role) => {
      const client = new FakeManagementClient();
      const actorContext = context(role);

      const service = await createManagedService(
        actorContext,
        validInput,
        client,
        { resolver: publicResolver },
      );

      expect(client.auditLogs).toHaveLength(1);
      expect(client.auditLogs[0]).toMatchObject({
        action: serviceAuditActions.created,
        workspaceId: "workspace_1",
        actorUserId: "user_1",
        resourceId: service.id,
      });

      await updateManagedService(
        actorContext,
        service.id,
        { ...validInput, expectedVersion: "2026.07" },
        client,
        { resolver: publicResolver },
      );
      expect(client.auditLogs).toHaveLength(2);
      expect(client.auditLogs[1]).toMatchObject({
        action: serviceAuditActions.updated,
      });

      await deactivateManagedService(actorContext, service.id, client);
      expect(client.auditLogs).toHaveLength(3);
      expect(client.auditLogs[2]).toMatchObject({
        action: serviceAuditActions.deactivated,
      });
      expect(service.isActive).toBe(false);

      await reactivateManagedService(actorContext, service.id, client);
      expect(client.auditLogs).toHaveLength(4);
      expect(client.auditLogs[3]).toMatchObject({
        action: serviceAuditActions.reactivated,
      });
      expect(service.isActive).toBe(true);
    },
  );

  it("denies Viewer service mutations without audit records", async () => {
    const client = new FakeManagementClient();
    const service = client.seedService();
    const viewer = context(WorkspaceRole.VIEWER);

    await expect(
      createManagedService(viewer, validInput, client, { resolver: publicResolver }),
    ).rejects.toThrow(PermissionDeniedError);
    await expect(
      updateManagedService(viewer, service.id, validInput, client, { resolver: publicResolver }),
    ).rejects.toThrow(PermissionDeniedError);
    await expect(
      deactivateManagedService(viewer, service.id, client),
    ).rejects.toThrow(PermissionDeniedError);
    await expect(
      reactivateManagedService(viewer, service.id, client),
    ).rejects.toThrow(PermissionDeniedError);
    expect(client.auditLogs).toHaveLength(0);
  });

  it("returns not found for cross-workspace mutation attempts", async () => {
    const client = new FakeManagementClient();
    const service = client.seedService({ workspaceId: "workspace_2" });

    await expect(
      updateManagedService(
        context(WorkspaceRole.OWNER, "workspace_1"),
        service.id,
        validInput,
        client,
        { resolver: publicResolver },
      ),
    ).rejects.toThrow(ServiceNotFoundError);
    expect(client.auditLogs).toHaveLength(0);
  });

  it("rejects duplicate slugs within a workspace without an audit record", async () => {
    const client = new FakeManagementClient();
    client.seedService({ slug: "payments-api" });

    await expect(
      createManagedService(
        context(WorkspaceRole.OWNER),
        validInput,
        client,
        { resolver: publicResolver },
      ),
    ).rejects.toMatchObject({
      fieldErrors: {
        slug: [`Slug "payments-api" is already used in this workspace.`],
      },
    });
    expect(client.auditLogs).toHaveLength(0);
  });

  it("rejects unsafe production targets before persistence", async () => {
    const client = new FakeManagementClient();

    await expect(
      createManagedService(
        context(WorkspaceRole.OWNER),
        {
          ...validInput,
          baseUrl: "http://localhost:3000",
          environment: ServiceEnvironment.PRODUCTION,
        },
        client,
        {
          environment: {
            APP_VERSION: "production",
            HEALTH_CHECK_LOCAL_ALLOWLIST_ENABLED: "false",
          } as unknown as NodeJS.ProcessEnv,
        },
      ),
    ).rejects.toThrow(ServiceMutationValidationError);
    expect(client.services).toHaveLength(0);
    expect(client.auditLogs).toHaveLength(0);
  });

  it("keeps the narrow local Docker allowlist working", async () => {
    const client = new FakeManagementClient();

    await expect(
      createManagedService(
        context(WorkspaceRole.OWNER),
        {
          ...validInput,
          baseUrl: "http://app:3000",
          healthPath: "/api/health",
          environment: ServiceEnvironment.LOCAL,
        },
        client,
        {
          environment: {
            APP_VERSION: "local",
            HEALTH_CHECK_LOCAL_ALLOWLIST_ENABLED: "true",
            HEALTH_CHECK_LOCAL_ALLOWED_TARGETS: "app:3000",
          } as unknown as NodeJS.ProcessEnv,
        },
      ),
    ).resolves.toMatchObject({ baseUrl: "http://app:3000" });
    expect(client.auditLogs).toHaveLength(1);
  });
});
