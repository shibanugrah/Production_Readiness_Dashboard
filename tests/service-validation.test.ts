import { ServiceEnvironment } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { validateServiceInput } from "@/server/services/validation";

const validServiceInput = {
  name: "Demo Service",
  slug: "Demo_Service",
  baseUrl: "http://localhost:3000",
  healthPath: "/api/health",
  environment: ServiceEnvironment.LOCAL,
  expectedVersion: "local",
};

describe("service validation", () => {
  it("accepts valid service input and normalizes the slug", () => {
    expect(validateServiceInput(validServiceInput)).toEqual({
      ...validServiceInput,
      slug: "demo-service",
    });
  });

  it("rejects invalid service URLs", () => {
    expect(() =>
      validateServiceInput({
        ...validServiceInput,
        baseUrl: "ftp://localhost/service",
      }),
    ).toThrow();
  });

  it("rejects invalid health paths", () => {
    expect(() =>
      validateServiceInput({
        ...validServiceInput,
        healthPath: "api/health",
      }),
    ).toThrow();
  });

  it("rejects browser-provided internal fields", () => {
    const unsafeInput = {
      ...validServiceInput,
      workspaceId: "workspace_1",
      status: "HEALTHY",
    } as unknown as Parameters<typeof validateServiceInput>[0];

    expect(() =>
      validateServiceInput(unsafeInput),
    ).toThrow();
  });
});
