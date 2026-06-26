import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/internal/health-checks/run/route";
import { runHealthChecks } from "@/server/health-checks/runner";

vi.mock("@/server/health-checks/runner", () => ({
  runHealthChecks: vi.fn(),
}));

const mockedRunHealthChecks = vi.mocked(runHealthChecks);

function requestWithSecret(secret?: string) {
  const headers = new Headers();

  if (secret) {
    headers.set("x-internal-health-check-secret", secret);
  }

  return new Request("http://localhost:3000/api/internal/health-checks/run", {
    method: "POST",
    headers,
  });
}

describe("internal health check runner route", () => {
  beforeEach(() => {
    process.env.INTERNAL_HEALTH_CHECK_SECRET = "route-test-secret";
    mockedRunHealthChecks.mockReset();
    mockedRunHealthChecks.mockResolvedValue({
      checked: 1,
      healthy: 1,
      degraded: 0,
      down: 0,
      skipped: 0,
      errors: 0,
    });
  });

  it("rejects missing internal secrets", async () => {
    const response = await POST(requestWithSecret());

    expect(response.status).toBe(401);
    expect(mockedRunHealthChecks).not.toHaveBeenCalled();
  });

  it("rejects wrong internal secrets", async () => {
    const response = await POST(requestWithSecret("wrong-secret"));

    expect(response.status).toBe(403);
    expect(mockedRunHealthChecks).not.toHaveBeenCalled();
  });

  it("runs checks and returns the summary for an authorized request", async () => {
    const response = await POST(requestWithSecret("route-test-secret"));

    await expect(response.json()).resolves.toEqual({
      checked: 1,
      healthy: 1,
      degraded: 0,
      down: 0,
      skipped: 0,
      errors: 0,
    });
    expect(response.status).toBe(200);
    expect(mockedRunHealthChecks).toHaveBeenCalledOnce();
  });
});
