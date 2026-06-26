import { describe, expect, it, vi } from "vitest";

import { buildHealthResponse } from "@/server/health";

const fixedNow = () => new Date("2026-06-26T00:00:00.000Z");
const validEnv = {
  DATABASE_URL:
    "postgresql://postgres:postgres@localhost:5432/production_readiness_dashboard?schema=public",
  AUTH_SECRET: "auth-secret",
  INTERNAL_HEALTH_CHECK_SECRET: "internal-secret",
  NODE_ENV: "test",
  APP_VERSION: "test-version",
} as NodeJS.ProcessEnv;

describe("health response", () => {
  it("returns the successful health response shape when the database is connected", async () => {
    const client = {
      $queryRawUnsafe: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
    };

    await expect(
      buildHealthResponse({ client, environment: validEnv, now: fixedNow }),
    ).resolves.toEqual({
      httpStatus: 200,
      body: {
        status: "ok",
        service: "production-readiness-dashboard",
        version: "test-version",
        timestamp: "2026-06-26T00:00:00.000Z",
        database: "connected",
      },
    });
    expect(client.$queryRawUnsafe).toHaveBeenCalledWith("SELECT 1");
  });

  it("returns a safe 503 response when the database is unavailable", async () => {
    const client = {
      $queryRawUnsafe: vi.fn().mockRejectedValue(new Error("connection failed")),
    };

    await expect(
      buildHealthResponse({ client, environment: validEnv, now: fixedNow }),
    ).resolves.toEqual({
      httpStatus: 503,
      body: {
        status: "error",
        service: "production-readiness-dashboard",
        version: "test-version",
        timestamp: "2026-06-26T00:00:00.000Z",
        database: "unavailable",
      },
    });
  });

  it("returns a safe 503 response when environment validation fails", async () => {
    const client = {
      $queryRawUnsafe: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
    };
    const invalidEnv = {
      ...validEnv,
      DATABASE_URL: "",
    } as NodeJS.ProcessEnv;

    const response = await buildHealthResponse({
      client,
      environment: invalidEnv,
      now: fixedNow,
    });

    expect(response.httpStatus).toBe(503);
    expect(response.body).toEqual({
      status: "error",
      service: "production-readiness-dashboard",
      version: "test-version",
      timestamp: "2026-06-26T00:00:00.000Z",
      database: "unavailable",
    });
    expect(client.$queryRawUnsafe).not.toHaveBeenCalled();
  });
});
