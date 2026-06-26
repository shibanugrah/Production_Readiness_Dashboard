import { randomUUID } from "node:crypto";

import { PrismaClient, Service } from "@prisma/client";

import { prisma } from "@/server/db";
import {
  CheckableService,
  ClassifiedCheck,
} from "@/server/health-checks/types";

export type HealthCheckPersistenceClient = Pick<
  PrismaClient,
  "$transaction" | "healthCheck" | "service"
>;

export type AcquiredServiceLock = {
  token: string;
  expiresAt: Date;
};

const defaultLockTtlMs = 15_000;
const defaultClient = prisma as HealthCheckPersistenceClient;

export async function acquireServiceCheckLock(
  service: Pick<CheckableService, "id">,
  client: HealthCheckPersistenceClient = defaultClient,
  now = new Date(),
  lockTtlMs = defaultLockTtlMs,
) {
  const lock = {
    token: randomUUID(),
    expiresAt: new Date(now.getTime() + lockTtlMs),
  };

  const result = await client.service.updateMany({
    where: {
      id: service.id,
      isActive: true,
      OR: [
        { checkLockExpiresAt: null },
        { checkLockExpiresAt: { lt: now } },
      ],
    },
    data: {
      checkLockToken: lock.token,
      checkLockExpiresAt: lock.expiresAt,
    },
  });

  if (result.count === 0) {
    return null;
  }

  return lock;
}

export async function releaseServiceCheckLock(
  service: Pick<CheckableService, "id">,
  lock: AcquiredServiceLock,
  client: HealthCheckPersistenceClient = defaultClient,
) {
  await client.service.updateMany({
    where: {
      id: service.id,
      checkLockToken: lock.token,
    },
    data: {
      checkLockToken: null,
      checkLockExpiresAt: null,
    },
  });
}

export async function persistHealthCheckResult(
  service: CheckableService,
  lock: AcquiredServiceLock,
  result: ClassifiedCheck,
  client: HealthCheckPersistenceClient = defaultClient,
) {
  await client.$transaction([
    client.healthCheck.create({
      data: {
        requestId: result.requestId,
        workspaceId: service.workspaceId,
        serviceId: service.id,
        status: result.healthCheckStatus,
        httpStatus: result.httpStatus,
        responseTimeMs: result.responseTimeMs,
        observedVersion: result.observedVersion,
        migrationVersion: result.migrationVersion,
        message: result.message,
        checkedAt: result.checkedAt,
      },
    }),
    client.service.updateMany({
      where: {
        id: service.id,
        workspaceId: service.workspaceId,
        checkLockToken: lock.token,
      },
      data: {
        status: result.serviceStatus,
        lastCheckedAt: result.checkedAt,
        lastHealthyAt: result.receivedValidOkPayload
          ? result.checkedAt
          : undefined,
        checkLockToken: null,
        checkLockExpiresAt: null,
      },
    }),
  ]);
}

export function toCheckableService(service: Service): CheckableService {
  return {
    id: service.id,
    workspaceId: service.workspaceId,
    name: service.name,
    baseUrl: service.baseUrl,
    healthPath: service.healthPath,
    environment: service.environment,
    expectedVersion: service.expectedVersion,
    status: service.status,
    isActive: service.isActive,
  };
}
