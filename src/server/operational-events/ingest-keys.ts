import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { OperationalEventIngestKey, PrismaClient, WorkspaceRole } from "@prisma/client";
import { z } from "zod";

import { AuthenticatedWorkspaceContext } from "@/server/auth/context";
import {
  PermissionDeniedError,
  canManageWorkspace,
} from "@/server/auth/permissions";
import { prisma } from "@/server/db";

export const eventIngestKeyAuditActions = {
  created: "EVENT_INGEST_KEY_CREATED",
  revoked: "EVENT_INGEST_KEY_REVOKED",
} as const;

export const eventIngestKeyResourceType = "OPERATIONAL_EVENT_INGEST_KEY";

const tokenPrefix = "prd_evt";
const keyInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  source: z.string().trim().min(1).max(80),
});

export type EventIngestKeyInput = z.input<typeof keyInputSchema>;

export type EventIngestKeyMetadata = Pick<
  OperationalEventIngestKey,
  | "id"
  | "workspaceId"
  | "name"
  | "source"
  | "lookupId"
  | "isActive"
  | "lastUsedAt"
  | "revokedAt"
  | "createdByUserId"
  | "createdAt"
  | "updatedAt"
>;

export type CreatedEventIngestKey = {
  metadata: EventIngestKeyMetadata;
  token: string;
};

type KeyManagementClient = Pick<
  PrismaClient,
  "$transaction" | "operationalEventIngestKey" | "auditLog"
>;

const defaultClient = prisma as KeyManagementClient;

export class EventIngestKeyValidationError extends Error {
  constructor(readonly fieldErrors: Record<string, string[]>) {
    super("Event ingestion key validation failed.");
    this.name = "EventIngestKeyValidationError";
  }
}

export class EventIngestKeyNotFoundError extends Error {
  constructor() {
    super("Event ingestion key not found.");
    this.name = "EventIngestKeyNotFoundError";
  }
}

function assertOwner(context: Pick<AuthenticatedWorkspaceContext, "role">) {
  if (!canManageWorkspace(context)) {
    throw new PermissionDeniedError(
      "Only workspace Owners can manage event ingestion keys.",
    );
  }
}

function hashSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

export function hashEventIngestSecret(secret: string) {
  return hashSecret(secret);
}

export function secretsMatch(providedSecret: string, expectedHash: string) {
  const providedHash = Buffer.from(hashSecret(providedSecret), "hex");
  const expected = Buffer.from(expectedHash, "hex");

  return (
    providedHash.length === expected.length &&
    timingSafeEqual(providedHash, expected)
  );
}

function randomTokenPart(byteLength: number) {
  return randomBytes(byteLength).toString("base64url");
}

function createTokenParts() {
  const lookupId = randomTokenPart(16);
  const secret = randomTokenPart(32);

  return {
    lookupId,
    secret,
    token: `${tokenPrefix}_${lookupId}.${secret}`,
  };
}

function toKeyMetadata(
  key: OperationalEventIngestKey,
): EventIngestKeyMetadata {
  return {
    id: key.id,
    workspaceId: key.workspaceId,
    name: key.name,
    source: key.source,
    lookupId: key.lookupId,
    isActive: key.isActive,
    lastUsedAt: key.lastUsedAt,
    revokedAt: key.revokedAt,
    createdByUserId: key.createdByUserId,
    createdAt: key.createdAt,
    updatedAt: key.updatedAt,
  };
}

export function parseEventIngestToken(token: string | null) {
  if (!token) {
    return null;
  }

  const match = token.match(/^prd_evt_([A-Za-z0-9_-]{16,})\.([A-Za-z0-9_-]{32,})$/);

  if (!match) {
    return null;
  }

  return {
    lookupId: match[1],
    secret: match[2],
  };
}

export function getProvidedEventIngestToken(request: Request) {
  const directToken = request.headers.get("x-operational-event-ingest-key");

  if (directToken) {
    return directToken;
  }

  const authorization = request.headers.get("authorization");
  const bearerPrefix = "Bearer ";

  if (authorization?.startsWith(bearerPrefix)) {
    return authorization.slice(bearerPrefix.length);
  }

  return null;
}

export function parseEventIngestKeyFormData(formData: FormData): EventIngestKeyInput {
  return {
    name: String(formData.get("name") ?? ""),
    source: String(formData.get("source") ?? ""),
  };
}

export async function createOperationalEventIngestKey(
  context: AuthenticatedWorkspaceContext,
  input: EventIngestKeyInput,
  client: KeyManagementClient = defaultClient,
): Promise<CreatedEventIngestKey> {
  assertOwner(context);
  const parsed = keyInputSchema.safeParse(input);

  if (!parsed.success) {
    throw new EventIngestKeyValidationError(parsed.error.flatten().fieldErrors);
  }

  const tokenParts = createTokenParts();

  const metadata = await client.$transaction(async (tx) => {
    const key = await tx.operationalEventIngestKey.create({
      data: {
        workspaceId: context.workspaceId,
        name: parsed.data.name,
        source: parsed.data.source,
        lookupId: tokenParts.lookupId,
        secretHash: hashSecret(tokenParts.secret),
        createdByUserId: context.user.id,
      },
    });

    await tx.auditLog.create({
      data: {
        workspaceId: context.workspaceId,
        actorUserId: context.user.id,
        action: eventIngestKeyAuditActions.created,
        resourceType: eventIngestKeyResourceType,
        resourceId: key.id,
        metadataJson: {
          summary: "Operational event ingestion key created",
          name: key.name,
          source: key.source,
          lookupId: key.lookupId,
        },
      },
    });

    return key;
  });

  return {
    metadata: toKeyMetadata(metadata),
    token: tokenParts.token,
  };
}

export async function revokeOperationalEventIngestKey(
  context: AuthenticatedWorkspaceContext,
  keyId: string,
  client: KeyManagementClient = defaultClient,
) {
  assertOwner(context);

  const existing = await client.operationalEventIngestKey.findFirst({
    where: {
      id: keyId,
      workspaceId: context.workspaceId,
    },
  });

  if (!existing) {
    throw new EventIngestKeyNotFoundError();
  }

  if (!existing.isActive || existing.revokedAt) {
    return existing;
  }

  return client.$transaction(async (tx) => {
    const key = await tx.operationalEventIngestKey.update({
      where: { id: keyId },
      data: {
        isActive: false,
        revokedAt: new Date(),
      },
    });

    await tx.auditLog.create({
      data: {
        workspaceId: context.workspaceId,
        actorUserId: context.user.id,
        action: eventIngestKeyAuditActions.revoked,
        resourceType: eventIngestKeyResourceType,
        resourceId: key.id,
        metadataJson: {
          summary: "Operational event ingestion key revoked",
          name: key.name,
          source: key.source,
          lookupId: key.lookupId,
        },
      },
    });

    return key;
  });
}

export function canManageEventIngestKeys(context: { role: WorkspaceRole }) {
  return canManageWorkspace(context);
}
