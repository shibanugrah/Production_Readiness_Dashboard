import { describe, expect, it } from "vitest";

import {
  UnsafeHealthCheckTargetError,
  validateHealthCheckTarget,
} from "@/server/health-checks/target-safety";

const productionEnv = {
  NODE_ENV: "production",
} as NodeJS.ProcessEnv;

const developmentEnv = {
  NODE_ENV: "development",
  APP_VERSION: "local",
  HEALTH_CHECK_LOCAL_ALLOWLIST_ENABLED: "true",
  HEALTH_CHECK_LOCAL_ALLOWED_TARGETS: "localhost:3000",
} as NodeJS.ProcessEnv;

describe("health check target safety", () => {
  it("rejects private and localhost targets in production mode", async () => {
    for (const baseUrl of [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://10.0.0.1",
      "http://172.16.0.1",
      "http://192.168.1.5",
      "http://169.254.169.254",
    ]) {
      await expect(
        validateHealthCheckTarget(
          { baseUrl, healthPath: "/health" },
          { environment: productionEnv },
        ),
      ).rejects.toThrow(UnsafeHealthCheckTargetError);
    }
  });

  it("rejects production DNS results that resolve to private addresses", async () => {
    await expect(
      validateHealthCheckTarget(
        { baseUrl: "https://internal.example.test", healthPath: "/health" },
        {
          environment: productionEnv,
          resolver: async () => [{ address: "10.1.2.3", family: 4 }],
        },
      ),
    ).rejects.toThrow("resolved to a private network address");
  });

  it("allows only explicitly configured local development targets", async () => {
    await expect(
      validateHealthCheckTarget(
        { baseUrl: "http://localhost:3000", healthPath: "/api/health" },
        { environment: developmentEnv },
      ),
    ).resolves.toMatchObject({
      href: "http://localhost:3000/api/health",
    });

    await expect(
      validateHealthCheckTarget(
        { baseUrl: "http://localhost:4000", healthPath: "/api/health" },
        { environment: developmentEnv },
      ),
    ).rejects.toThrow(UnsafeHealthCheckTargetError);
  });

  it("rejects unsafe schemes and embedded credentials", async () => {
    await expect(
      validateHealthCheckTarget(
        { baseUrl: "ftp://example.test", healthPath: "/health" },
        { environment: productionEnv },
      ),
    ).rejects.toThrow("must use http or https");

    await expect(
      validateHealthCheckTarget(
        { baseUrl: "https://user:pass@example.test", healthPath: "/health" },
        { environment: productionEnv },
      ),
    ).rejects.toThrow("must not contain credentials");
  });
});
