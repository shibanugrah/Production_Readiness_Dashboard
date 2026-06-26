import { ServiceEnvironment, ServiceStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { executeHealthCheck } from "@/server/health-checks/execution";
import { CheckableService } from "@/server/health-checks/types";

const service: CheckableService = {
  id: "service_1",
  workspaceId: "workspace_1",
  name: "Demo",
  baseUrl: "http://localhost:3000",
  healthPath: "/health",
  environment: ServiceEnvironment.LOCAL,
  expectedVersion: null,
  status: ServiceStatus.UNKNOWN,
  isActive: true,
};

const environment = {
  NODE_ENV: "development",
  APP_VERSION: "local",
  HEALTH_CHECK_LOCAL_ALLOWLIST_ENABLED: "true",
  HEALTH_CHECK_LOCAL_ALLOWED_TARGETS: "localhost:3000",
} as NodeJS.ProcessEnv;

describe("health check execution", () => {
  it("captures invalid JSON as a safe failed execution", async () => {
    await expect(
      executeHealthCheck(service, {
        environment,
        fetchImpl: async () => new Response("not-json", { status: 200 }),
      }),
    ).resolves.toMatchObject({
      httpStatus: 200,
      payload: null,
      errorMessage: "Health endpoint returned invalid JSON.",
      redirected: false,
    });
  });

  it("marks redirects without following them", async () => {
    await expect(
      executeHealthCheck(service, {
        environment,
        fetchImpl: async () =>
          new Response("", {
            status: 302,
            headers: { location: "https://example.test/new-place" },
          }),
      }),
    ).resolves.toMatchObject({
      httpStatus: 302,
      redirected: true,
    });
  });

  it("captures timeout and network failures with safe messages", async () => {
    await expect(
      executeHealthCheck(service, {
        environment,
        fetchImpl: async () => {
          throw new DOMException("aborted", "AbortError");
        },
      }),
    ).resolves.toMatchObject({
      httpStatus: null,
      errorMessage: "Health check request timed out.",
    });

    await expect(
      executeHealthCheck(service, {
        environment,
        fetchImpl: async () => {
          throw new Error("getaddrinfo ENOTFOUND demo");
        },
      }),
    ).resolves.toMatchObject({
      httpStatus: null,
      errorMessage: "getaddrinfo ENOTFOUND demo",
    });
  });
});
