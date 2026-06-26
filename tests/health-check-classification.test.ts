import { HealthCheckStatus, ServiceStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { classifyHealthCheck } from "@/server/health-checks/classification";
import { ExecutedCheck } from "@/server/health-checks/types";

const checkedAt = new Date("2026-06-26T00:00:00.000Z");

function executedCheck(overrides: Partial<ExecutedCheck> = {}): ExecutedCheck {
  return {
    requestId: "request_1",
    checkedAt,
    responseTimeMs: 120,
    httpStatus: 200,
    payload: { status: "ok", version: "local-demo" },
    errorMessage: null,
    redirected: false,
    ...overrides,
  };
}

describe("health check classification", () => {
  it("classifies a fast valid 2xx response as healthy", () => {
    expect(
      classifyHealthCheck(
        { expectedVersion: "local-demo" },
        executedCheck(),
      ),
    ).toMatchObject({
      healthCheckStatus: HealthCheckStatus.SUCCESS,
      serviceStatus: ServiceStatus.HEALTHY,
      receivedValidOkPayload: true,
    });
  });

  it("classifies a slow valid response as degraded", () => {
    expect(
      classifyHealthCheck(
        { expectedVersion: "local-demo" },
        executedCheck({ responseTimeMs: 1_700 }),
      ),
    ).toMatchObject({
      healthCheckStatus: HealthCheckStatus.DEGRADED,
      serviceStatus: ServiceStatus.DEGRADED,
      receivedValidOkPayload: true,
    });
  });

  it("classifies an expected version mismatch as degraded", () => {
    expect(
      classifyHealthCheck(
        { expectedVersion: "expected-version" },
        executedCheck(),
      ),
    ).toMatchObject({
      healthCheckStatus: HealthCheckStatus.DEGRADED,
      serviceStatus: ServiceStatus.DEGRADED,
      observedVersion: "local-demo",
      receivedValidOkPayload: true,
    });
  });

  it("classifies HTTP 4xx and 5xx responses as down", () => {
    for (const httpStatus of [404, 503]) {
      expect(
        classifyHealthCheck(
          { expectedVersion: null },
          executedCheck({ httpStatus, payload: { error: "nope" } }),
        ),
      ).toMatchObject({
        healthCheckStatus: HealthCheckStatus.FAILURE,
        serviceStatus: ServiceStatus.DOWN,
        receivedValidOkPayload: false,
      });
    }
  });

  it("classifies invalid payloads, network failures, and redirects as down", () => {
    for (const check of [
      executedCheck({ payload: { status: "error" } }),
      executedCheck({
        httpStatus: null,
        errorMessage: "Health check request failed.",
      }),
      executedCheck({ httpStatus: 302, redirected: true }),
    ]) {
      expect(classifyHealthCheck({ expectedVersion: null }, check)).toMatchObject(
        {
          healthCheckStatus: HealthCheckStatus.FAILURE,
          serviceStatus: ServiceStatus.DOWN,
          receivedValidOkPayload: false,
        },
      );
    }
  });
});
