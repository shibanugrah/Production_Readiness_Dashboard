import {
  Prisma,
  Service,
  ServiceEnvironment,
  ServiceStatus,
} from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/server/db";
import {
  PermissionDeniedError,
  canManageServices,
} from "@/server/auth/permissions";
import {
  TargetSafetyOptions,
  UnsafeHealthCheckTargetError,
  validateHealthCheckTarget,
} from "@/server/health-checks/target-safety";
import {
  ServiceInput,
  ValidatedServiceInput,
  serviceInputSchema,
} from "@/server/services/validation";
import { AuthenticatedWorkspaceContext } from "@/server/auth/context";

export const serviceAuditActions = {
  created: "SERVICE_CREATED",
  updated: "SERVICE_UPDATED",
  deactivated: "SERVICE_DEACTIVATED",
  reactivated: "SERVICE_REACTIVATED",
} as const;

const serviceResourceType = "SERVICE";

type ServiceAuditAction =
  (typeof serviceAuditActions)[keyof typeof serviceAuditActions];

type FieldErrorMap = Record<string, string[]>;

type AuditMetadata = {
  summary: string;
  changes?: Array<{
    field: string;
    from?: string | null;
    to?: string | null;
  }>;
};
type AuditChange = NonNullable<AuditMetadata["changes"]>[number];

type AuditCreateArgs = {
  data: {
    workspaceId: string;
    actorUserId: string;
    action: ServiceAuditAction;
    resourceType: typeof serviceResourceType;
    resourceId: string;
    metadataJson: AuditMetadata;
  };
};

type ServiceCreateArgs = {
  data: {
    workspaceId: string;
    name: string;
    slug: string;
    baseUrl: string;
    healthPath: string;
    environment: ServiceEnvironment;
    expectedVersion: string | null;
    status: ServiceStatus;
    isActive?: boolean;
  };
};

type ServiceUpdateManyArgs = {
  where: {
    id: string;
    workspaceId: string;
    isActive?: boolean;
  };
  data: Partial<{
    name: string;
    slug: string;
    baseUrl: string;
    healthPath: string;
    environment: ServiceEnvironment;
    expectedVersion: string | null;
    isActive: boolean;
    checkLockToken: string | null;
    checkLockExpiresAt: Date | null;
  }>;
};

type ServiceFindFirstArgs = {
  where: {
    id?: string;
    workspaceId: string;
    slug?: string;
    NOT?: { id: string };
  };
};

export type ServiceManagementTransactionClient = {
  service: {
    create: (args: ServiceCreateArgs) => Promise<Service>;
    updateMany: (
      args: ServiceUpdateManyArgs,
    ) => Promise<{ count: number }>;
  };
  auditLog: {
    create: (args: AuditCreateArgs) => Promise<unknown>;
  };
};

export type ServiceManagementClient = {
  $transaction: <T>(
    callback: (tx: ServiceManagementTransactionClient) => Promise<T>,
  ) => Promise<T>;
  service: {
    findFirst: (args: ServiceFindFirstArgs) => Promise<Service | null>;
  };
};

const defaultClient = prisma as unknown as ServiceManagementClient;

export class ServiceMutationValidationError extends Error {
  constructor(readonly fieldErrors: FieldErrorMap) {
    super("Service validation failed.");
    this.name = "ServiceMutationValidationError";
  }
}

export class ServiceNotFoundError extends Error {
  constructor() {
    super("Service not found.");
    this.name = "ServiceNotFoundError";
  }
}

function assertCanManageServices(
  context: Pick<AuthenticatedWorkspaceContext, "role">,
) {
  if (!canManageServices(context)) {
    throw new PermissionDeniedError(
      "Your role cannot manage services in this workspace.",
    );
  }
}

function parseServiceInput(input: ServiceInput) {
  const parsed = serviceInputSchema.safeParse(input);

  if (!parsed.success) {
    throw new ServiceMutationValidationError(parsed.error.flatten().fieldErrors);
  }

  return parsed.data;
}

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

async function ensureSafeTarget(
  input: Pick<ValidatedServiceInput, "baseUrl" | "healthPath">,
  options?: TargetSafetyOptions,
) {
  try {
    await validateHealthCheckTarget(input, options);
  } catch (error) {
    if (error instanceof UnsafeHealthCheckTargetError) {
      throw new ServiceMutationValidationError({
        baseUrl: [error.message],
      });
    }

    throw error;
  }
}

function nullishVersion(value: string | null | undefined) {
  return value?.trim() ? value.trim() : null;
}

function valueForAudit(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return String(value);
}

function change(
  field: string,
  from: unknown,
  to: unknown,
): AuditChange | null {
  const safeFrom = valueForAudit(from);
  const safeTo = valueForAudit(to);

  if (safeFrom === safeTo) {
    return null;
  }

  return { field, from: safeFrom, to: safeTo };
}

function configurationChanges(
  previous: Service,
  next: ValidatedServiceInput,
): AuditChange[] {
  return [
    change("name", previous.name, next.name),
    change("slug", previous.slug, next.slug),
    change("base URL", previous.baseUrl, next.baseUrl),
    change("health path", previous.healthPath, next.healthPath),
    change("environment", previous.environment, next.environment),
    change(
      "expected version",
      previous.expectedVersion,
      nullishVersion(next.expectedVersion),
    ),
  ].filter((item): item is NonNullable<typeof item> => item !== null);
}

function createAuditMetadata(input: ValidatedServiceInput): AuditMetadata {
  return {
    summary: "Service created",
    changes: [
      { field: "name", to: input.name },
      { field: "slug", to: input.slug },
      { field: "base URL", to: input.baseUrl },
      { field: "health path", to: input.healthPath },
      { field: "environment", to: input.environment },
      { field: "expected version", to: nullishVersion(input.expectedVersion) },
      { field: "monitoring state", to: "enabled" },
    ],
  };
}

function duplicateSlugError(slug: string) {
  return new ServiceMutationValidationError({
    slug: [`Slug "${slug}" is already used in this workspace.`],
  });
}

export async function createManagedService(
  context: AuthenticatedWorkspaceContext,
  input: ServiceInput,
  client: ServiceManagementClient = defaultClient,
  safetyOptions?: TargetSafetyOptions,
) {
  assertCanManageServices(context);
  const parsed = parseServiceInput(input);
  const existing = await client.service.findFirst({
    where: {
      workspaceId: context.workspaceId,
      slug: parsed.slug,
    },
  });

  if (existing) {
    throw duplicateSlugError(parsed.slug);
  }

  await ensureSafeTarget(parsed, safetyOptions);

  try {
    return await client.$transaction(async (tx) => {
      const service = await tx.service.create({
        data: {
          workspaceId: context.workspaceId,
          name: parsed.name,
          slug: parsed.slug,
          baseUrl: parsed.baseUrl,
          healthPath: parsed.healthPath,
          environment: parsed.environment,
          expectedVersion: nullishVersion(parsed.expectedVersion),
          status: ServiceStatus.UNKNOWN,
          isActive: true,
        },
      });

      await tx.auditLog.create({
        data: {
          workspaceId: context.workspaceId,
          actorUserId: context.user.id,
          action: serviceAuditActions.created,
          resourceType: serviceResourceType,
          resourceId: service.id,
          metadataJson: createAuditMetadata(parsed),
        },
      });

      return service;
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw duplicateSlugError(parsed.slug);
    }

    throw error;
  }
}

export async function updateManagedService(
  context: AuthenticatedWorkspaceContext,
  serviceId: string,
  input: ServiceInput,
  client: ServiceManagementClient = defaultClient,
  safetyOptions?: TargetSafetyOptions,
) {
  assertCanManageServices(context);
  const parsed = parseServiceInput(input);
  const existing = await client.service.findFirst({
    where: {
      id: serviceId,
      workspaceId: context.workspaceId,
    },
  });

  if (!existing) {
    throw new ServiceNotFoundError();
  }

  const duplicate = await client.service.findFirst({
    where: {
      workspaceId: context.workspaceId,
      slug: parsed.slug,
      NOT: { id: serviceId },
    },
  });

  if (duplicate) {
    throw duplicateSlugError(parsed.slug);
  }

  await ensureSafeTarget(parsed, safetyOptions);
  const changes = configurationChanges(existing, parsed);

  try {
    await client.$transaction(async (tx) => {
      const result = await tx.service.updateMany({
        where: {
          id: serviceId,
          workspaceId: context.workspaceId,
        },
        data: {
          name: parsed.name,
          slug: parsed.slug,
          baseUrl: parsed.baseUrl,
          healthPath: parsed.healthPath,
          environment: parsed.environment,
          expectedVersion: nullishVersion(parsed.expectedVersion),
        },
      });

      if (result.count === 0) {
        throw new ServiceNotFoundError();
      }

      await tx.auditLog.create({
        data: {
          workspaceId: context.workspaceId,
          actorUserId: context.user.id,
          action: serviceAuditActions.updated,
          resourceType: serviceResourceType,
          resourceId: serviceId,
          metadataJson: {
            summary: changes.length
              ? `${changes.length} configuration field${changes.length === 1 ? "" : "s"} updated`
              : "Configuration saved without field changes",
            changes,
          },
        },
      });
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw duplicateSlugError(parsed.slug);
    }

    throw error;
  }
}

async function setServiceActiveState(
  context: AuthenticatedWorkspaceContext,
  serviceId: string,
  isActive: boolean,
  action: ServiceAuditAction,
  client: ServiceManagementClient = defaultClient,
) {
  assertCanManageServices(context);

  const existing = await client.service.findFirst({
    where: {
      id: serviceId,
      workspaceId: context.workspaceId,
    },
  });

  if (!existing) {
    throw new ServiceNotFoundError();
  }

  if (existing.isActive === isActive) {
    throw new ServiceMutationValidationError({
      isActive: [
        isActive
          ? "Service monitoring is already active."
          : "Service monitoring is already inactive.",
      ],
    });
  }

  await client.$transaction(async (tx) => {
    const result = await tx.service.updateMany({
      where: {
        id: serviceId,
        workspaceId: context.workspaceId,
        isActive: !isActive,
      },
      data: {
        isActive,
        checkLockToken: isActive ? undefined : null,
        checkLockExpiresAt: isActive ? undefined : null,
      },
    });

    if (result.count === 0) {
      throw new ServiceNotFoundError();
    }

    await tx.auditLog.create({
      data: {
        workspaceId: context.workspaceId,
        actorUserId: context.user.id,
        action,
        resourceType: serviceResourceType,
        resourceId: serviceId,
        metadataJson: {
          summary: isActive ? "Service reactivated" : "Service deactivated",
          changes: [
            {
              field: "monitoring state",
              from: isActive ? "disabled" : "enabled",
              to: isActive ? "enabled" : "disabled",
            },
          ],
        },
      },
    });
  });
}

export function deactivateManagedService(
  context: AuthenticatedWorkspaceContext,
  serviceId: string,
  client: ServiceManagementClient = defaultClient,
) {
  return setServiceActiveState(
    context,
    serviceId,
    false,
    serviceAuditActions.deactivated,
    client,
  );
}

export function reactivateManagedService(
  context: AuthenticatedWorkspaceContext,
  serviceId: string,
  client: ServiceManagementClient = defaultClient,
) {
  return setServiceActiveState(
    context,
    serviceId,
    true,
    serviceAuditActions.reactivated,
    client,
  );
}

export function formDataToServiceInput(formData: FormData): ServiceInput {
  return {
    name: String(formData.get("name") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    baseUrl: String(formData.get("baseUrl") ?? ""),
    healthPath: String(formData.get("healthPath") ?? ""),
    environment: String(formData.get("environment") ?? "") as z.input<
      typeof serviceInputSchema
    >["environment"],
    expectedVersion:
      String(formData.get("expectedVersion") ?? "").trim() || undefined,
  };
}
