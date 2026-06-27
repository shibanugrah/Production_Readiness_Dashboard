import { beforeEach, describe, expect, it, vi } from "vitest";
import { HealthCheckRunStatus, HealthCheckRunTriggerType } from "@prisma/client";

import { POST as POST_RUN } from "@/app/api/internal/health-checks/run/route";
import { POST as POST_SCHEDULED_RUN } from "@/app/api/internal/health-checks/scheduled-run/route";
import { runHealthChecks } from "@/server/health-checks/runner";

vi.mock("@/server/health-checks/runner", () => ({
  runHealthChecks: vi.fn(),
}));

const mockedRunHealthChecks = vi.mocked(runHealthChecks);

function requestWithSecret(
  secret?: string,
  url = "http://localhost:3000/api/internal/health-checks/run",
) {
  const headers = new Headers();

  if (secret) {
    headers.set("x-internal-health-check-secret", secret);
  }

  return new Request(url, {
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
    const response = await POST_RUN(requestWithSecret());

    expect(response.status).toBe(401);
    expect(mockedRunHealthChecks).not.toHaveBeenCalled();
  });

  it("rejects wrong internal secrets", async () => {
    const response = await POST_RUN(requestWithSecret("wrong-secret"));

    expect(response.status).toBe(403);
    expect(mockedRunHealthChecks).not.toHaveBeenCalled();
  });

  it("runs checks and returns the summary for an authorized request", async () => {
    const response = await POST_RUN(requestWithSecret("route-test-secret"));

    await expect(response.json()).resolves.toEqual({
      checked: 1,
      healthy: 1,
      degraded: 0,
      down: 0,
      skipped: 0,
      errors: 0,
    });
    expect(response.status).toBe(200);
    expect(mockedRunHealthChecks).toHaveBeenCalledWith(undefined, {
      triggerType: HealthCheckRunTriggerType.SCHEDULED,
    });
  });

  it("creates scheduled runs with no requester identity", async () => {
    const response = await POST_SCHEDULED_RUN(
      requestWithSecret(
        "route-test-secret",
        "http://localhost:3000/api/internal/health-checks/scheduled-run",
      ),
    );

    expect(response.status).toBe(200);
    expect(mockedRunHealthChecks).toHaveBeenCalledWith(undefined, {
      triggerType: HealthCheckRunTriggerType.SCHEDULED,
      requestedByUserId: null,
    });
  });

  it("returns conflict when a scheduled workspace run is already active", async () => {
    mockedRunHealthChecks.mockResolvedValueOnce({
      checked: 0,
      healthy: 0,
      degraded: 0,
      down: 0,
      skipped: 0,
      errors: 0,
      status: HealthCheckRunStatus.SKIPPED,
    });

    const response = await POST_SCHEDULED_RUN(
      requestWithSecret(
        "route-test-secret",
        "http://localhost:3000/api/internal/health-checks/scheduled-run",
      ),
    );

    await expect(response.json()).resolves.toMatchObject({
      status: HealthCheckRunStatus.SKIPPED,
      message: "Another health-check run is already active for this workspace.",
    });
    expect(response.status).toBe(409);
  });

  it("rejects missing scheduled-run secrets", async () => {
    const response = await POST_SCHEDULED_RUN(
      requestWithSecret(
        undefined,
        "http://localhost:3000/api/internal/health-checks/scheduled-run",
      ),
    );

    expect(response.status).toBe(401);
    expect(mockedRunHealthChecks).not.toHaveBeenCalled();
  });

  it("rejects invalid scheduled-run secrets", async () => {
    const response = await POST_SCHEDULED_RUN(
      requestWithSecret(
        "wrong-secret",
        "http://localhost:3000/api/internal/health-checks/scheduled-run",
      ),
    );

    expect(response.status).toBe(403);
    expect(mockedRunHealthChecks).not.toHaveBeenCalled();
  });
});
