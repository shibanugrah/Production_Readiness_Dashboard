import { createHash } from "node:crypto";

import {
  OperationalEvent,
  OperationalEventSeverity,
  OperationalEventStatus,
  OperationalEventType,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/server/db";
import {
  getProvidedEventIngestToken,
  parseEventIngestToken,
  secretsMatch,
} from "@/server/operational-events/ingest-keys";

const maxBodyBytes = 32 * 1024;
const maxPayloadBytes = 12 * 1024;
const maxPayloadDepth = 6;
const maxErrorMessageLength = 500;
const sensitivePayloadKeys = [
  "authorization",
  "cookie",
  "password",
  "secret",
  "token",
  "apikey",
  "api_key",
];

const eventPayloadSchema = z
  .object({
    type: z.nativeEnum(OperationalEventType),
    severity: z.nativeEnum(OperationalEventSeverity),
    idempotencyKey: z.string().trim().min(1).max(160),
    occurredAt: z.string().datetime(),
    serviceId: z.string().trim().min(1).max(120).optional(),
    externalReference: z.string().trim().min(1).max(240).optional(),
    errorMessage: z.string().trim().max(maxErrorMessageLength).optional(),
    payload: z.unknown().optional(),
  })
  .strict();

type ValidatedEventPayload = z.infer<typeof eventPayloadSchema>;

export type AuthenticatedIngestKey = {
  id: string;
  workspaceId: string;
  source: string;
};

export type IngestOperationalEventResult = {
  event: OperationalEvent;
  replayed: boolean;
};

type IngestionClient = Pick<
  PrismaClient,
  "operationalEventIngestKey" | "operationalEvent" | "service"
>;

const defaultClient = prisma as IngestionClient;

export class EventIngestionAuthError extends Error {
  constructor(
    message: string,
    readonly status = 403,
  ) {
    super(message);
    this.name = "EventIngestionAuthError";
  }
}

export class EventIngestionValidationError extends Error {
  constructor(readonly fieldErrors: Record<string, string[]>) {
    super("Operational event validation failed.");
    this.name = "EventIngestionValidationError";
  }
}

export class EventIngestionConflictError extends Error {
  constructor(readonly eventId: string) {
    super("Idempotency key was already used with different event content.");
    this.name = "EventIngestionConflictError";
  }
}

function hashText(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizePayloadKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9_]/g, "");
}

function hasSensitivePayloadKey(key: string) {
  const normalized = normalizePayloadKey(key);
  return sensitivePayloadKeys.some((sensitiveKey) =>
    normalized.includes(sensitiveKey),
  );
}

function assertSafePayload(value: unknown, path = "payload", depth = 0) {
  if (depth > maxPayloadDepth) {
    throw new EventIngestionValidationError({
      payload: [`${path} exceeds the maximum supported depth.`],
    });
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertSafePayload(item, `${path}[${index}]`, depth + 1),
    );
    return;
  }

  if (value && typeof value === "object") {
    for (const [key, nestedValue] of Object.entries(value)) {
      if (hasSensitivePayloadKey(key)) {
        throw new EventIngestionValidationError({
          payload: [`${path}.${key} contains a sensitive field name.`],
        });
      }

      assertSafePayload(nestedValue, `${path}.${key}`, depth + 1);
    }
  }
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  return `{${entries
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(",")}}`;
}

function validatePayloadSize(payload: unknown) {
  if (payload === undefined) {
    return;
  }

  assertSafePayload(payload);
  const serialized = JSON.stringify(payload);

  if (!serialized || Buffer.byteLength(serialized, "utf8") > maxPayloadBytes) {
    throw new EventIngestionValidationError({
      payload: ["Payload exceeds the maximum supported size."],
    });
  }
}

function eventMessage(payload: ValidatedEventPayload) {
  if (payload.errorMessage?.trim()) {
    return payload.errorMessage.trim().slice(0, 160);
  }

  if (payload.externalReference?.trim()) {
    return `Operational event received: ${payload.externalReference.trim()}`;
  }

  return `${payload.type} operational event received`;
}

function payloadHashFor(
  source: string,
  payload: ValidatedEventPayload,
  serviceId: string | null,
) {
  return hashText(
    stableStringify({
      source,
      type: payload.type,
      severity: payload.severity,
      occurredAt: new Date(payload.occurredAt).toISOString(),
      serviceId,
      externalReference: payload.externalReference ?? null,
      errorMessage: payload.errorMessage ?? null,
      payload: payload.payload ?? null,
    }),
  );
}

function metadataJsonValue(payload: unknown) {
  if (payload === undefined || payload === null) {
    return Prisma.JsonNull;
  }

  return payload as Prisma.InputJsonValue;
}

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export function maxOperationalEventBodyBytes() {
  return maxBodyBytes;
}

export async function authenticateOperationalEventIngestKey(
  request: Request,
  client: IngestionClient = defaultClient,
): Promise<AuthenticatedIngestKey> {
  const token = parseEventIngestToken(getProvidedEventIngestToken(request));

  if (!token) {
    throw new EventIngestionAuthError("Missing or malformed event ingestion key.", 401);
  }

  const key = await client.operationalEventIngestKey.findUnique({
    where: { lookupId: token.lookupId },
  });

  if (!key || !secretsMatch(token.secret, key.secretHash)) {
    throw new EventIngestionAuthError("Invalid event ingestion key.", 403);
  }

  if (!key.isActive || key.revokedAt) {
    throw new EventIngestionAuthError("Event ingestion key is inactive.", 403);
  }

  await client.operationalEventIngestKey.update({
    where: { id: key.id },
    data: { lastUsedAt: new Date() },
  });

  return {
    id: key.id,
    workspaceId: key.workspaceId,
    source: key.source,
  };
}

export function parseOperationalEventPayload(input: unknown) {
  const parsed = eventPayloadSchema.safeParse(input);

  if (!parsed.success) {
    throw new EventIngestionValidationError(parsed.error.flatten().fieldErrors);
  }

  validatePayloadSize(parsed.data.payload);
  return parsed.data;
}

export async function ingestOperationalEvent(
  authenticatedKey: AuthenticatedIngestKey,
  input: unknown,
  client: IngestionClient = defaultClient,
): Promise<IngestOperationalEventResult> {
  const payload = parseOperationalEventPayload(input);
  let serviceId: string | null = payload.serviceId ?? null;

  if (serviceId) {
    const service = await client.service.findFirst({
      where: {
        id: serviceId,
        workspaceId: authenticatedKey.workspaceId,
      },
      select: { id: true },
    });

    if (!service) {
      throw new EventIngestionValidationError({
        serviceId: ["Service was not found in this workspace."],
      });
    }

    serviceId = service.id;
  }

  const payloadHash = payloadHashFor(authenticatedKey.source, payload, serviceId);
  const existing = await client.operationalEvent.findFirst({
    where: {
      workspaceId: authenticatedKey.workspaceId,
      source: authenticatedKey.source,
      idempotencyKey: payload.idempotencyKey,
    },
  });

  if (existing) {
    if (existing.payloadHash === payloadHash) {
      return { event: existing, replayed: true };
    }

    throw new EventIngestionConflictError(existing.id);
  }

  try {
    const event = await client.operationalEvent.create({
      data: {
        workspaceId: authenticatedKey.workspaceId,
        serviceId,
        source: authenticatedKey.source,
        type: payload.type,
        severity: payload.severity,
        status: OperationalEventStatus.OPEN,
        message: eventMessage(payload),
        externalReference: payload.externalReference ?? null,
        errorMessage: payload.errorMessage ?? null,
        metadata: metadataJsonValue(payload.payload),
        payloadHash,
        idempotencyKey: payload.idempotencyKey,
        occurredAt: new Date(payload.occurredAt),
      },
    });

    return { event, replayed: false };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const duplicate = await client.operationalEvent.findFirst({
        where: {
          workspaceId: authenticatedKey.workspaceId,
          source: authenticatedKey.source,
          idempotencyKey: payload.idempotencyKey,
        },
      });

      if (duplicate?.payloadHash === payloadHash) {
        return { event: duplicate, replayed: true };
      }

      if (duplicate) {
        throw new EventIngestionConflictError(duplicate.id);
      }
    }

    throw error;
  }
}
