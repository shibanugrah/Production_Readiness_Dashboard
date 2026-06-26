import { describe, expect, it } from "vitest";

import { validateEnv } from "@/env";

const validEnv = {
  DATABASE_URL:
    "postgresql://postgres:postgres@localhost:5432/production_readiness_dashboard?schema=public",
  AUTH_SECRET: "auth-secret",
  INTERNAL_HEALTH_CHECK_SECRET: "internal-secret",
  NODE_ENV: "test",
  APP_VERSION: "test-version",
} as NodeJS.ProcessEnv;

describe("environment validation", () => {
  it("accepts the required Phase 0 environment", () => {
    expect(validateEnv(validEnv)).toMatchObject({
      DATABASE_URL: validEnv.DATABASE_URL,
      AUTH_SECRET: validEnv.AUTH_SECRET,
      INTERNAL_HEALTH_CHECK_SECRET: validEnv.INTERNAL_HEALTH_CHECK_SECRET,
      NODE_ENV: "test",
      APP_VERSION: "test-version",
    });
  });

  it("rejects a missing database URL", () => {
    const invalidEnv = { ...validEnv };
    delete invalidEnv.DATABASE_URL;

    expect(() => validateEnv(invalidEnv as NodeJS.ProcessEnv)).toThrow();
  });

  it("rejects an invalid node environment", () => {
    expect(() =>
      validateEnv({
        ...validEnv,
        NODE_ENV: "staging",
      } as unknown as NodeJS.ProcessEnv),
    ).toThrow();
  });
});
