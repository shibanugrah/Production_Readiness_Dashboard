import { ServiceStatus } from "@prisma/client";

import { prisma } from "@/server/db";
import { classifyHealthCheck } from "@/server/health-checks/classification";
import {
  ExecuteHealthCheckOptions,
  executeHealthCheck,
} from "@/server/health-checks/execution";
import {
  acquireServiceCheckLock,
  HealthCheckPersistenceClient,
  persistHealthCheckResult,
  releaseServiceCheckLock,
  toCheckableService,
} from "@/server/health-checks/persistence";
import {
  emptyHealthCheckRunSummary,
  HealthCheckRunSummary,
} from "@/server/health-checks/types";

export type HealthCheckRunnerClient = HealthCheckPersistenceClient;
export type RunHealthChecksOptions = ExecuteHealthCheckOptions & {
  workspaceId?: string;
};

const defaultClient = prisma as HealthCheckRunnerClient;

function countServiceStatus(
  summary: HealthCheckRunSummary,
  status: ServiceStatus,
) {
  if (status === ServiceStatus.HEALTHY) {
    summary.healthy += 1;
  } else if (status === ServiceStatus.DEGRADED) {
    summary.degraded += 1;
  } else if (status === ServiceStatus.DOWN) {
    summary.down += 1;
  }
}

export async function runHealthChecks(
  client: HealthCheckRunnerClient | undefined = defaultClient,
  options: RunHealthChecksOptions = {},
) {
  const runnerClient = client ?? defaultClient;
  const summary = emptyHealthCheckRunSummary();
  const services = await runnerClient.service.findMany({
    where: options.workspaceId ? { workspaceId: options.workspaceId } : undefined,
    orderBy: [{ workspaceId: "asc" }, { name: "asc" }],
  });

  for (const rawService of services) {
    const service = toCheckableService(rawService);

    if (!service.isActive) {
      summary.skipped += 1;
      continue;
    }

    const lock = await acquireServiceCheckLock(service, runnerClient);

    if (!lock) {
      summary.skipped += 1;
      continue;
    }

    try {
      const executedCheck = await executeHealthCheck(service, options);
      const classifiedCheck = classifyHealthCheck(service, executedCheck);
      await persistHealthCheckResult(service, lock, classifiedCheck, runnerClient);

      summary.checked += 1;
      countServiceStatus(summary, classifiedCheck.serviceStatus);
    } catch {
      summary.errors += 1;
      await releaseServiceCheckLock(service, lock, runnerClient);
    }
  }

  return summary;
}
