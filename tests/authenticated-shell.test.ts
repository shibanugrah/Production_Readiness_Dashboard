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
});
