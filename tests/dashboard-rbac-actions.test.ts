import { HealthCheckRunTriggerType, WorkspaceRole } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  addLocalDemoServiceAction,
  runManualChecksAction,
} from "@/server/dashboard/actions";
import { getDashboardContext } from "@/server/dashboard/read-models";
import { runHealthChecks } from "@/server/health-checks/runner";
import { createManagedService } from "@/server/services/management";
import { revalidatePath } from "next/cache";

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/server/dashboard/local-demo", () => ({
  isLocalDemoActionsEnabled: () => false,
}));

vi.mock("@/server/dashboard/read-models", () => ({
  getDashboardContext: vi.fn(),
}));

vi.mock("@/server/health-checks/runner", () => ({
  runHealthChecks: vi.fn(),
}));

vi.mock("@/server/services/management", () => ({
  createManagedService: vi.fn(),
  formDataToServiceInput: vi.fn(() => ({
    name: "Demo Service",
    slug: "demo-service",
    baseUrl: "http://app:3000",
    healthPath: "/api/health",
    environment: "LOCAL",
  })),
}));

function context(role: WorkspaceRole) {
  return {
    workspace: {
      id: "workspace_1",
      name: "Portfolio Operations",
      slug: "portfolio-operations",
    },
    context: {
      workspaceId: "workspace_1",
      userId: "user_1",
      role,
      user: {
        id: "user_1",
        name: "Demo User",
        email: "demo@example.local",
      },
      workspace: {
        id: "workspace_1",
        name: "Portfolio Operations",
        slug: "portfolio-operations",
      },
    },
  };
}

describe("dashboard mutation RBAC", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAppVersion = process.env.APP_VERSION;
  const originalLocalAllowlist = process.env.HEALTH_CHECK_LOCAL_ALLOWLIST_ENABLED;

  beforeEach(() => {
    vi.mocked(getDashboardContext).mockReset();
    vi.mocked(runHealthChecks).mockReset();
    vi.mocked(createManagedService).mockReset();
    vi.mocked(revalidatePath).mockReset();
    Reflect.set(process.env, "NODE_ENV", "production");
    process.env.APP_VERSION = "bb51b65";
    process.env.HEALTH_CHECK_LOCAL_ALLOWLIST_ENABLED = "false";
  });

  afterEach(() => {
    Reflect.set(process.env, "NODE_ENV", originalNodeEnv);

    if (originalAppVersion === undefined) {
      delete process.env.APP_VERSION;
    } else {
      process.env.APP_VERSION = originalAppVersion;
    }

    if (originalLocalAllowlist === undefined) {
      delete process.env.HEALTH_CHECK_LOCAL_ALLOWLIST_ENABLED;
    } else {
      process.env.HEALTH_CHECK_LOCAL_ALLOWLIST_ENABLED = originalLocalAllowlist;
    }
  });

  it("denies Viewer run-check attempts server-side", async () => {
    vi.mocked(getDashboardContext).mockResolvedValue(context(WorkspaceRole.VIEWER));
    const formData = new FormData();
    formData.set("returnPath", "/");

    await expect(runManualChecksAction(formData)).rejects.toThrow(
      "NEXT_REDIRECT:/?checks=denied",
    );
    expect(runHealthChecks).not.toHaveBeenCalled();
  });

  it.each([WorkspaceRole.OWNER, WorkspaceRole.ADMIN])(
    "allows %s users to run production-mode manual checks for their workspace",
    async (role) => {
      vi.mocked(getDashboardContext).mockResolvedValue(context(role));
      vi.mocked(runHealthChecks).mockResolvedValue({
        checked: 1,
        healthy: 1,
        degraded: 0,
        down: 0,
        skipped: 0,
        errors: 0,
      });
      const formData = new FormData();
      formData.set("returnPath", "/services/service_1");

      await expect(runManualChecksAction(formData)).rejects.toThrow(
        "NEXT_REDIRECT:/services/service_1?checks=success",
      );
      expect(runHealthChecks).toHaveBeenCalledWith(undefined, {
        workspaceId: "workspace_1",
        triggerType: HealthCheckRunTriggerType.MANUAL,
        requestedByUserId: "user_1",
      });
      expect(revalidatePath).toHaveBeenCalledWith("/");
      expect(revalidatePath).toHaveBeenCalledWith("/services");
      expect(revalidatePath).toHaveBeenCalledWith("/services/service_1");
    },
  );

  it("keeps empty production history honest after a zero-service manual run", async () => {
    vi.mocked(getDashboardContext).mockResolvedValue(context(WorkspaceRole.OWNER));
    vi.mocked(runHealthChecks).mockResolvedValue({
      checked: 0,
      healthy: 0,
      degraded: 0,
      down: 0,
      skipped: 0,
      errors: 0,
    });
    const formData = new FormData();
    formData.set("returnPath", "/");

    await expect(runManualChecksAction(formData)).rejects.toThrow(
      "NEXT_REDIRECT:/?checks=success",
    );
    expect(runHealthChecks).toHaveBeenCalledWith(undefined, {
      workspaceId: "workspace_1",
      triggerType: HealthCheckRunTriggerType.MANUAL,
      requestedByUserId: "user_1",
    });
  });

  it("denies Viewer service creation attempts server-side", async () => {
    vi.mocked(getDashboardContext).mockResolvedValue(context(WorkspaceRole.VIEWER));
    const formData = new FormData();
    formData.set("returnPath", "/services");

    await expect(addLocalDemoServiceAction(formData)).rejects.toThrow(
      "NEXT_REDIRECT:/services?service=denied",
    );
    expect(createManagedService).not.toHaveBeenCalled();
  });
});
