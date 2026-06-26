import {
  Service,
  ServiceEnvironment,
  ServiceStatus,
} from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  createService,
  DuplicateServiceSlugError,
  getServiceForWorkspace,
  listServicesForWorkspace,
  ServiceRepositoryClient,
  updateServiceForWorkspace,
} from "@/server/services/repository";
import { createTrustedWorkspaceContext } from "@/server/workspace-context";

const validInput = {
  name: "Payments API",
  slug: "payments-api",
  baseUrl: "https://payments.example.test",
  healthPath: "/health",
  environment: ServiceEnvironment.STAGING,
  expectedVersion: "2026.06",
};

class FakeServiceClient implements ServiceRepositoryClient {
  private nextId = 1;
  private readonly services: Service[] = [];

  readonly service: ServiceRepositoryClient["service"] = {
    findUnique: async (args) => {
      const service = this.services.find(
        (item) =>
          item.workspaceId === args.where.workspaceId_slug.workspaceId &&
          item.slug === args.where.workspaceId_slug.slug,
      );

      return service ? { id: service.id } : null;
    },
    findFirst: async (args) =>
      this.services.find((service) => this.matchesWhere(service, args.where)) ??
      null,
    findMany: async (args) =>
      this.services
        .filter((service) => service.workspaceId === args.where.workspaceId)
        .sort((left, right) => left.name.localeCompare(right.name)),
    create: async (args) => this.insertService(args.data),
    updateMany: async (args) => {
      const service = this.services.find(
        (item) =>
          item.id === args.where.id &&
          item.workspaceId === args.where.workspaceId,
      );

      if (!service) {
        return { count: 0 };
      }

      Object.assign(service, args.data, { updatedAt: new Date() });
      return { count: 1 };
    },
  };

  seedService(input: {
    workspaceId: string;
    slug: string;
    id?: string;
    name?: string;
  }) {
    return this.insertService({
      workspaceId: input.workspaceId,
      name: input.name ?? input.slug,
      slug: input.slug,
      baseUrl: "https://example.test",
      healthPath: "/health",
      environment: ServiceEnvironment.LOCAL,
      expectedVersion: null,
      status: ServiceStatus.UNKNOWN,
    }, input.id);
  }

  private insertService(
    input: Parameters<ServiceRepositoryClient["service"]["create"]>[0]["data"],
    id = `service_${this.nextId++}`,
  ) {
    const now = new Date();
    const service: Service = {
      id,
      workspaceId: input.workspaceId,
      name: input.name,
      slug: input.slug,
      baseUrl: input.baseUrl,
      healthPath: input.healthPath,
      environment: input.environment,
      expectedVersion: input.expectedVersion ?? null,
      status: input.status,
      isActive: true,
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
    where: Parameters<ServiceRepositoryClient["service"]["findFirst"]>[0]["where"],
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

    return true;
  }
}

describe("service repository", () => {
  it("rejects duplicate slugs in the same workspace", async () => {
    const client = new FakeServiceClient();
    const context = createTrustedWorkspaceContext("workspace_1", "user_1");

    await createService(context, validInput, client);

    await expect(createService(context, validInput, client)).rejects.toThrow(
      DuplicateServiceSlugError,
    );
  });

  it("allows the same slug in separate workspaces", async () => {
    const client = new FakeServiceClient();

    await expect(
      createService(
        createTrustedWorkspaceContext("workspace_1"),
        validInput,
        client,
      ),
    ).resolves.toMatchObject({ slug: "payments-api" });
    await expect(
      createService(
        createTrustedWorkspaceContext("workspace_2"),
        validInput,
        client,
      ),
    ).resolves.toMatchObject({ slug: "payments-api" });
  });

  it("never returns another workspace's service from scoped queries", async () => {
    const client = new FakeServiceClient();
    const workspaceOne = createTrustedWorkspaceContext("workspace_1");
    const workspaceTwo = createTrustedWorkspaceContext("workspace_2");
    const serviceOne = client.seedService({
      workspaceId: workspaceOne.workspaceId,
      slug: "workspace-one-service",
      id: "service_1",
    });
    const serviceTwo = client.seedService({
      workspaceId: workspaceTwo.workspaceId,
      slug: "workspace-two-service",
      id: "service_2",
    });

    await expect(listServicesForWorkspace(workspaceOne, client)).resolves.toEqual([
      serviceOne,
    ]);
    await expect(
      getServiceForWorkspace(workspaceOne, serviceTwo.id, client),
    ).resolves.toBeNull();
    await expect(
      updateServiceForWorkspace(workspaceOne, serviceTwo.id, validInput, client),
    ).resolves.toBeNull();
  });

  it("starts new services in the UNKNOWN state", async () => {
    const client = new FakeServiceClient();

    await expect(
      createService(createTrustedWorkspaceContext("workspace_1"), validInput, client),
    ).resolves.toMatchObject({
      status: ServiceStatus.UNKNOWN,
    });
  });
});
