import { WorkspaceRole } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  addLocalDemoServiceAction,
  runLocalChecksAction,
} from "@/server/dashboard/actions";
import { getDashboardContext } from "@/server/dashboard/read-models";
import { runHealthChecks } from "@/server/health-checks/runner";
import { createManagedService } from "@/server/services/management";

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/server/dashboard/local-demo", () => ({
  isLocalDemoActionsEnabled: () => true,
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
  it("denies Viewer run-check attempts server-side", async () => {
    vi.mocked(getDashboardContext).mockResolvedValue(context(WorkspaceRole.VIEWER));
    const formData = new FormData();
    formData.set("returnPath", "/");

    await expect(runLocalChecksAction(formData)).rejects.toThrow(
      "NEXT_REDIRECT:/?checks=denied",
    );
    expect(runHealthChecks).not.toHaveBeenCalled();
  });

  it("allows Admin users to run checks for their workspace", async () => {
    vi.mocked(getDashboardContext).mockResolvedValue(context(WorkspaceRole.ADMIN));
    vi.mocked(runHealthChecks).mockResolvedValue({
      checked: 1,
      healthy: 1,
      degraded: 0,
      down: 0,
      skipped: 0,
      errors: 0,
    });
    const formData = new FormData();
    formData.set("returnPath", "/services");

    await expect(runLocalChecksAction(formData)).rejects.toThrow(
      "NEXT_REDIRECT:/services?checks=success",
    );
    expect(runHealthChecks).toHaveBeenCalledWith(undefined, {
      workspaceId: "workspace_1",
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
