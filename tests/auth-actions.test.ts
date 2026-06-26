import { describe, expect, it, vi } from "vitest";

import { signOutAction } from "@/server/auth/actions";
import { destroyCurrentSession } from "@/server/auth/session";

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

vi.mock("@/server/auth/session", () => ({
  destroyCurrentSession: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

describe("auth actions", () => {
  it("destroys the current session on sign out", async () => {
    await expect(signOutAction()).rejects.toThrow(
      "NEXT_REDIRECT:/signin?signedOut=1",
    );
    expect(destroyCurrentSession).toHaveBeenCalledOnce();
  });
});
