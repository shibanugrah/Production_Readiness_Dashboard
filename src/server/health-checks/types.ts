import {
  HealthCheckStatus,
  ServiceEnvironment,
  ServiceStatus,
} from "@prisma/client";

export type CheckableService = {
  id: string;
  workspaceId: string;
  name: string;
  baseUrl: string;
  healthPath: string;
  environment: ServiceEnvironment;
  expectedVersion: string | null;
  status: ServiceStatus;
  isActive: boolean;
};

export type ValidHealthPayload = {
  status: "ok";
  service?: string;
  version?: string;
  migrationVersion?: string;
  timestamp?: string;
};

export type ExecutedCheck = {
  requestId: string;
  checkedAt: Date;
  responseTimeMs: number;
  httpStatus: number | null;
  payload: unknown;
  errorMessage: string | null;
  redirected: boolean;
};

export type ClassifiedCheck = {
  requestId: string;
  checkedAt: Date;
  healthCheckStatus: HealthCheckStatus;
  serviceStatus: ServiceStatus;
  httpStatus: number | null;
  responseTimeMs: number | null;
  observedVersion: string | null;
  migrationVersion: string | null;
  message: string | null;
  receivedValidOkPayload: boolean;
};

export type HealthCheckRunSummary = {
  checked: number;
  healthy: number;
  degraded: number;
  down: number;
  skipped: number;
  errors: number;
};

export function emptyHealthCheckRunSummary(): HealthCheckRunSummary {
  return {
    checked: 0,
    healthy: 0,
    degraded: 0,
    down: 0,
    skipped: 0,
    errors: 0,
  };
}
