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

  it("rejects production local allowlist configuration", () => {
    expect(() =>
      validateEnv({
        ...validProductionEnv,
        HEALTH_CHECK_LOCAL_ALLOWLIST_ENABLED: "true",
      }),
    ).toThrow(/HEALTH_CHECK_LOCAL_ALLOWLIST_ENABLED/);

    expect(() =>
      validateEnv({
        ...validProductionEnv,
        HEALTH_CHECK_LOCAL_ALLOWED_TARGETS: "localhost:3000",
      }),
    ).toThrow(/HEALTH_CHECK_LOCAL_ALLOWED_TARGETS/);
  });

  it("rejects local app version in production", () => {
    expect(() =>
      validateEnv({
        ...validProductionEnv,
        APP_VERSION: "local",
      }),
    ).toThrow(/APP_VERSION/);
  });

  it("rejects placeholder or weak production secrets", () => {
    expect(() =>
      validateEnv({
        ...validProductionEnv,
        AUTH_SECRET: "replace-with-a-generated-secret",
      }),
    ).toThrow(/AUTH_SECRET/);

    expect(() =>
      validateEnv({
        ...validProductionEnv,
        INTERNAL_HEALTH_CHECK_SECRET: "short",
      }),
    ).toThrow(/INTERNAL_HEALTH_CHECK_SECRET/);
  });

  it("rejects development demo health controls in production", () => {
    expect(() =>
      validateEnv({
        ...validProductionEnv,
        DEMO_SERVICE_HEALTH_ENABLED: "true",
      }),
    ).toThrow(/DEMO_SERVICE_HEALTH_ENABLED/);
  });

  it("requires explicit safe server-side config before enabling public demo access", () => {
    expect(() =>
      validateEnv({
        ...validProductionEnv,
        PUBLIC_DEMO_ACCESS_ENABLED: "true",
      }),
    ).toThrow(/PUBLIC_DEMO_APP_BASE_URL/);

    expect(() =>
      validateEnv({
        ...validProductionEnv,
        PUBLIC_DEMO_ACCESS_ENABLED: "true",
        PUBLIC_DEMO_APP_BASE_URL: "http://localhost:3000",
        PUBLIC_DEMO_VIEWER_EMAIL: "viewer@example.invalid",
      }),
    ).toThrow(/PUBLIC_DEMO_APP_BASE_URL/);
  });

  it("accepts public demo access only with explicit runtime configuration", () => {
    expect(
      validateEnv({
        ...validProductionEnv,
        PUBLIC_DEMO_ACCESS_ENABLED: "true",
        PUBLIC_DEMO_APP_BASE_URL: "https://readiness.example.invalid",
        PUBLIC_DEMO_VIEWER_EMAIL: "viewer@example.invalid",
      }),
    ).toMatchObject({
      PUBLIC_DEMO_ACCESS_ENABLED: "true",
      PUBLIC_DEMO_APP_BASE_URL: "https://readiness.example.invalid",
    });
  });

  it("accepts valid production values without exposing them", () => {
    expect(validateEnv(validProductionEnv)).toMatchObject({
      NODE_ENV: "production",
      APP_VERSION: "2026.06.27-test-build",
      HEALTH_CHECK_LOCAL_ALLOWLIST_ENABLED: "false",
      DEMO_SERVICE_HEALTH_ENABLED: "false",
      PUBLIC_DEMO_ACCESS_ENABLED: "false",
    });
  });
});

const validProductionEnv = {
  DATABASE_URL:
    "postgresql://prod_user:prod_password@db.example.invalid:5432/production_readiness_dashboard?schema=public",
  AUTH_SECRET: "prod-auth-value-0123456789abcdef1234",
  INTERNAL_HEALTH_CHECK_SECRET: "prod-internal-value-0123456789abcdef",
  NODE_ENV: "production",
  APP_VERSION: "2026.06.27-test-build",
  HEALTH_CHECK_LOCAL_ALLOWLIST_ENABLED: "false",
  HEALTH_CHECK_LOCAL_ALLOWED_TARGETS: "",
  DEMO_SERVICE_HEALTH_ENABLED: "false",
  PUBLIC_DEMO_ACCESS_ENABLED: "false",
} as NodeJS.ProcessEnv;
