import { HealthCheckStatus, ServiceStatus } from "@prisma/client";

import { safeValidateHealthPayload } from "@/server/health-checks/response";
import {
  CheckableService,
  ClassifiedCheck,
  ExecutedCheck,
} from "@/server/health-checks/types";

export const degradedLatencyThresholdMs = 1_500;

export function classifyHealthCheck(
  service: Pick<CheckableService, "expectedVersion">,
  executedCheck: ExecutedCheck,
): ClassifiedCheck {
  const baseResult = {
    requestId: executedCheck.requestId,
    checkedAt: executedCheck.checkedAt,
    httpStatus: executedCheck.httpStatus,
    responseTimeMs: executedCheck.responseTimeMs,
    observedVersion: null,
    migrationVersion: null,
    receivedValidOkPayload: false,
  };

  if (executedCheck.redirected) {
    return {
      ...baseResult,
      healthCheckStatus: HealthCheckStatus.FAILURE,
      serviceStatus: ServiceStatus.DOWN,
      message: "Redirect responses are not followed by health checks.",
    };
  }

  if (executedCheck.errorMessage) {
    return {
      ...baseResult,
      healthCheckStatus: HealthCheckStatus.FAILURE,
      serviceStatus: ServiceStatus.DOWN,
      message: executedCheck.errorMessage,
    };
  }

  if (
    executedCheck.httpStatus === null ||
    executedCheck.httpStatus < 200 ||
    executedCheck.httpStatus >= 300
  ) {
    return {
      ...baseResult,
      healthCheckStatus: HealthCheckStatus.FAILURE,
      serviceStatus: ServiceStatus.DOWN,
      message: `Health endpoint returned HTTP ${executedCheck.httpStatus ?? "unknown"}.`,
    };
  }

  const healthPayload = safeValidateHealthPayload(executedCheck.payload);

  if (!healthPayload) {
    return {
      ...baseResult,
      healthCheckStatus: HealthCheckStatus.FAILURE,
      serviceStatus: ServiceStatus.DOWN,
      message: "Health endpoint returned an invalid health payload.",
    };
  }

  const result = {
    ...baseResult,
    observedVersion: healthPayload.version ?? null,
    migrationVersion: healthPayload.migrationVersion ?? null,
    receivedValidOkPayload: true,
  };

  if (
    service.expectedVersion &&
    healthPayload.version !== service.expectedVersion
  ) {
    return {
      ...result,
      healthCheckStatus: HealthCheckStatus.DEGRADED,
      serviceStatus: ServiceStatus.DEGRADED,
      message: "Health endpoint version did not match the expected version.",
    };
  }

  if (executedCheck.responseTimeMs > degradedLatencyThresholdMs) {
    return {
      ...result,
      healthCheckStatus: HealthCheckStatus.DEGRADED,
      serviceStatus: ServiceStatus.DEGRADED,
      message: `Health endpoint latency exceeded ${degradedLatencyThresholdMs}ms.`,
    };
  }

  return {
    ...result,
    healthCheckStatus: HealthCheckStatus.SUCCESS,
    serviceStatus: ServiceStatus.HEALTHY,
    message: null,
  };
}
