import {
  HealthCheckRunStatus,
  HealthCheckRunTriggerType,
  Service,
  ServiceStatus,
} from "@prisma/client";

import { prisma } from "@/server/db";
import { classifyHealthCheck } from "@/server/health-checks/classification";
import {
  ExecuteHealthCheckOptions,
  executeHealthCheck,
} from "@/server/health-checks/execution";
import {
  acquireServiceCheckLock,
  acquireWorkspaceRunLease,
  HealthCheckPersistenceClient,
  persistHealthCheckResult,
  releaseServiceCheckLock,
  releaseWorkspaceRunLease,
  toCheckableService,
} from "@/server/health-checks/persistence";
import {
  emptyHealthCheckRunSummary,
  HealthCheckRunSummary,
} from "@/server/health-checks/types";

export type HealthCheckRunnerClient = HealthCheckPersistenceClient;
export type RunHealthChecksOptions = ExecuteHealthCheckOptions & {
  workspaceId?: string;
  triggerType?: HealthCheckRunTriggerType;
  requestedByUserId?: string | null;
  workspaceLeaseTtlMs?: number;
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

function mergeSummary(
  target: HealthCheckRunSummary,
  source: HealthCheckRunSummary,
) {
  target.checked += source.checked;
  target.healthy += source.healthy;
  target.degraded += source.degraded;
  target.down += source.down;
  target.skipped += source.skipped;
  target.errors += source.errors;
}

function safeRunErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.slice(0, 300);
  }

  return "Unexpected health check run failure.";
}

function runSummaryData(summary: HealthCheckRunSummary) {
  return {
    checkedCount: summary.checked,
    healthyCount: summary.healthy,
    degradedCount: summary.degraded,
    downCount: summary.down,
    skippedCount: summary.skipped,
    errorCount: summary.errors,
  };
}

function serviceOrderBy() {
  return [{ workspaceId: "asc" as const }, { name: "asc" as const }];
}

async function finishRun(
  client: HealthCheckRunnerClient,
  runId: string,
  status: HealthCheckRunStatus,
  summary: HealthCheckRunSummary,
  errorMessage: string | null = null,
) {
  await client.healthCheckRun.update({
    where: { id: runId },
    data: {
      status,
      finishedAt: new Date(),
      errorMessage,
      ...runSummaryData(summary),
    },
  });
}

async function runWorkspaceHealthChecks(
  runnerClient: HealthCheckRunnerClient,
  workspaceId: string,
  options: RunHealthChecksOptions,
  preloadedServices?: Service[],
) {
  const triggerType = options.triggerType ?? HealthCheckRunTriggerType.SCHEDULED;
  const summary = emptyHealthCheckRunSummary();
  const run = await runnerClient.healthCheckRun.create({
    data: {
      workspaceId,
      triggerType,
      requestedByUserId:
        triggerType === HealthCheckRunTriggerType.MANUAL
          ? (options.requestedByUserId ?? null)
          : null,
      status: HealthCheckRunStatus.RUNNING,
    },
  });

  summary.runId = run.id;
  summary.triggerType = triggerType;

  let lease: Awaited<ReturnType<typeof acquireWorkspaceRunLease>> = null;

  try {
    lease = await acquireWorkspaceRunLease(
      workspaceId,
      runnerClient,
      new Date(),
      options.workspaceLeaseTtlMs,
    );

    if (!lease) {
      summary.status = HealthCheckRunStatus.SKIPPED;
      await finishRun(
        runnerClient,
        run.id,
        HealthCheckRunStatus.SKIPPED,
        summary,
        "Another health-check run is already active for this workspace.",
      );
      return summary;
    }

    const services =
      preloadedServices ??
      (await runnerClient.service.findMany({
        where: { workspaceId },
        orderBy: serviceOrderBy(),
      }));

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
        await persistHealthCheckResult(
          service,
          lock,
          classifiedCheck,
          runnerClient,
          run.id,
        );

        summary.checked += 1;
        countServiceStatus(summary, classifiedCheck.serviceStatus);
      } catch {
        summary.errors += 1;
        await releaseServiceCheckLock(service, lock, runnerClient);
      }
    }

    summary.status = HealthCheckRunStatus.COMPLETED;
    await finishRun(runnerClient, run.id, HealthCheckRunStatus.COMPLETED, summary);
    return summary;
  } catch (error) {
    summary.status = HealthCheckRunStatus.FAILED;
    summary.errorMessage = safeRunErrorMessage(error);
    await finishRun(
      runnerClient,
      run.id,
      HealthCheckRunStatus.FAILED,
      summary,
      summary.errorMessage,
    );
    throw error;
  } finally {
    if (lease) {
      await releaseWorkspaceRunLease(workspaceId, lease.token, runnerClient);
    }
  }
}

export async function runHealthChecks(
  client: HealthCheckRunnerClient | undefined = defaultClient,
  options: RunHealthChecksOptions = {},
) {
  const runnerClient = client ?? defaultClient;
  if (options.workspaceId) {
    return runWorkspaceHealthChecks(runnerClient, options.workspaceId, options);
  }

  const services = await runnerClient.service.findMany({
    where: undefined,
    orderBy: serviceOrderBy(),
  });
  const servicesByWorkspace = new Map<string, Service[]>();

  for (const service of services) {
    const workspaceServices = servicesByWorkspace.get(service.workspaceId) ?? [];
    workspaceServices.push(service);
    servicesByWorkspace.set(service.workspaceId, workspaceServices);
  }

  const summary = emptyHealthCheckRunSummary();
  const workspaceSummaries: HealthCheckRunSummary[] = [];

  for (const [workspaceId, workspaceServices] of servicesByWorkspace) {
    const workspaceSummary = await runWorkspaceHealthChecks(
      runnerClient,
      workspaceId,
      options,
      workspaceServices,
    );
    workspaceSummaries.push(workspaceSummary);
    mergeSummary(summary, workspaceSummary);
  }

  if (workspaceSummaries.length === 1) {
    const [workspaceSummary] = workspaceSummaries;
    summary.runId = workspaceSummary.runId;
    summary.triggerType = workspaceSummary.triggerType;
    summary.status = workspaceSummary.status;
    summary.errorMessage = workspaceSummary.errorMessage;
  } else if (
    workspaceSummaries.length > 0 &&
    workspaceSummaries.every(
      (workspaceSummary) => workspaceSummary.status === HealthCheckRunStatus.SKIPPED,
    )
  ) {
    summary.triggerType = options.triggerType ?? HealthCheckRunTriggerType.SCHEDULED;
    summary.status = HealthCheckRunStatus.SKIPPED;
  }

  return summary;
}
