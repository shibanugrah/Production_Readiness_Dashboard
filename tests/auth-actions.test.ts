import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

vi.mock("@/server/auth/session", () => ({
  createSession: vi.fn(),
  destroyCurrentSession: vi.fn(),
  setSessionCookie: vi.fn(),
}));

vi.mock("@/server/auth/password", () => ({
  verifyPassword: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import { signInAction, signOutAction } from "@/server/auth/actions";
import { prisma } from "@/server/db";
import { destroyCurrentSession } from "@/server/auth/session";

describe("auth actions", () => {
  it("destroys the current session on sign out", async () => {
    await expect(signOutAction()).rejects.toThrow(
      "NEXT_REDIRECT:/signin?signedOut=1",
    );
    expect(destroyCurrentSession).toHaveBeenCalledOnce();
  });

  it("redirects to an unavailable sign-in state when the database cannot be reached", async () => {
    vi.mocked(prisma.user.findUnique).mockRejectedValueOnce(
      new Error("database unavailable"),
    );
    const formData = new FormData();
    formData.set("email", "owner@example.local");
    formData.set("password", "password");
    formData.set("returnPath", "/services");

    await expect(signInAction(formData)).rejects.toThrow(
      "NEXT_REDIRECT:/signin?error=unavailable&returnPath=%2Fservices",
    );
  });
});
