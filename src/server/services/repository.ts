import { Prisma, Service, ServiceEnvironment, ServiceStatus } from "@prisma/client";

import { prisma } from "@/server/db";
import { TrustedWorkspaceContext } from "@/server/workspace-context";
import {
  ServiceInput,
  validateServiceInput,
} from "@/server/services/validation";

type ServiceIdSelect = { id: true };

type ServiceWhereUniqueArgs = {
  where: {
    workspaceId_slug: {
      workspaceId: string;
      slug: string;
    };
  };
  select: ServiceIdSelect;
};

type ServiceWhereArgs = {
  where: {
    id?: string;
    workspaceId?: string;
    slug?: string;
    NOT?: {
      id: string;
    };
  };
};

type ServiceListArgs = {
  where: {
    workspaceId: string;
  };
  orderBy: Array<{
    name?: "asc";
    createdAt?: "asc";
  }>;
};

type ServiceCreateArgs = {
  data: {
    workspaceId: string;
    name: string;
    slug: string;
    baseUrl: string;
    healthPath: string;
    environment: ServiceEnvironment;
    expectedVersion?: string | null;
    status: ServiceStatus;
  };
};

type ServiceUpdateManyArgs = {
  where: {
    id: string;
    workspaceId: string;
  };
  data: {
    name: string;
    slug: string;
    baseUrl: string;
    healthPath: string;
    environment: ServiceEnvironment;
    expectedVersion?: string | null;
  };
};

export type ServiceRepositoryClient = {
  service: {
    findUnique: (args: ServiceWhereUniqueArgs) => Promise<{ id: string } | null>;
    findFirst: (args: ServiceWhereArgs) => Promise<Service | null>;
    findMany: (args: ServiceListArgs) => Promise<Service[]>;
    create: (args: ServiceCreateArgs) => Promise<Service>;
    updateMany: (
      args: ServiceUpdateManyArgs,
    ) => Promise<{ count: number }>;
  };
};

const defaultClient = prisma as unknown as ServiceRepositoryClient;

export class DuplicateServiceSlugError extends Error {
  constructor(slug: string) {
    super(`Service slug already exists in this workspace: ${slug}`);
    this.name = "DuplicateServiceSlugError";
  }
}

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

async function ensureSlugAvailable(
  client: ServiceRepositoryClient,
  context: TrustedWorkspaceContext,
  slug: string,
  excludingServiceId?: string,
) {
  const existing = excludingServiceId
    ? await client.service.findFirst({
        where: {
          workspaceId: context.workspaceId,
          slug,
          NOT: { id: excludingServiceId },
        },
      })
    : await client.service.findUnique({
        where: {
          workspaceId_slug: {
            workspaceId: context.workspaceId,
            slug,
          },
        },
        select: { id: true },
      });

  if (existing) {
    throw new DuplicateServiceSlugError(slug);
  }
}

export async function createService(
  context: TrustedWorkspaceContext,
  input: ServiceInput,
  client: ServiceRepositoryClient = defaultClient,
) {
  const serviceInput = validateServiceInput(input);
  await ensureSlugAvailable(client, context, serviceInput.slug);

  try {
    return await client.service.create({
      data: {
        workspaceId: context.workspaceId,
        name: serviceInput.name,
        slug: serviceInput.slug,
        baseUrl: serviceInput.baseUrl,
        healthPath: serviceInput.healthPath,
        environment: serviceInput.environment,
        expectedVersion: serviceInput.expectedVersion ?? null,
        status: ServiceStatus.UNKNOWN,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new DuplicateServiceSlugError(serviceInput.slug);
    }

    throw error;
  }
}

export async function listServicesForWorkspace(
  context: TrustedWorkspaceContext,
  client: ServiceRepositoryClient = defaultClient,
) {
  return client.service.findMany({
    where: { workspaceId: context.workspaceId },
    orderBy: [{ name: "asc" }, { createdAt: "asc" }],
  });
}

export async function getServiceForWorkspace(
  context: TrustedWorkspaceContext,
  serviceId: string,
  client: ServiceRepositoryClient = defaultClient,
) {
  return client.service.findFirst({
    where: {
      id: serviceId,
      workspaceId: context.workspaceId,
    },
  });
}

export async function updateServiceForWorkspace(
  context: TrustedWorkspaceContext,
  serviceId: string,
  input: ServiceInput,
  client: ServiceRepositoryClient = defaultClient,
) {
  const serviceInput = validateServiceInput(input);
  await ensureSlugAvailable(client, context, serviceInput.slug, serviceId);

  try {
    const result = await client.service.updateMany({
      where: {
        id: serviceId,
        workspaceId: context.workspaceId,
      },
      data: {
        name: serviceInput.name,
        slug: serviceInput.slug,
        baseUrl: serviceInput.baseUrl,
        healthPath: serviceInput.healthPath,
        environment: serviceInput.environment,
        expectedVersion: serviceInput.expectedVersion ?? null,
      },
    });

    if (result.count === 0) {
      return null;
    }

    return getServiceForWorkspace(context, serviceId, client);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new DuplicateServiceSlugError(serviceInput.slug);
    }

    throw error;
  }
}
