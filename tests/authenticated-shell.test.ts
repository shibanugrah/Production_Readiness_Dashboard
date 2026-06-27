import { WorkspaceRole } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { AuthenticatedShell } from "@/components/dashboard/authenticated-shell";
import { getCurrentWorkspaceContext } from "@/server/auth/context";

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

vi.mock("@/server/auth/context", () => ({
  getCurrentWorkspaceContext: vi.fn(),
}));

describe("authenticated dashboard shell", () => {
  it("redirects unauthenticated users to sign-in", async () => {
    vi.mocked(getCurrentWorkspaceContext).mockResolvedValue(null);

    await expect(AuthenticatedShell({ children: null })).rejects.toThrow(
      "NEXT_REDIRECT:/signin",
    );
  });

  it("renders protected dashboard content for a valid session context", async () => {
    vi.mocked(getCurrentWorkspaceContext).mockResolvedValue({
      workspaceId: "workspace_1",
      userId: "user_1",
      role: WorkspaceRole.OWNER,
      user: {
        id: "user_1",
        name: "Demo Owner",
        email: "owner@example.local",
      },
      workspace: {
        id: "workspace_1",
        name: "Portfolio Operations",
        slug: "portfolio-operations",
      },
    });

    await expect(AuthenticatedShell({ children: null })).resolves.toBeTruthy();
  });
});
