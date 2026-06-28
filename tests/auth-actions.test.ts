import { beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("@/server/public-demo", () => ({
  getPublicDemoAvailability: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import {
  publicDemoSignInAction,
  signInAction,
  signOutAction,
} from "@/server/auth/actions";
import { prisma } from "@/server/db";
import { getPublicDemoAvailability } from "@/server/public-demo";
import {
  createSession,
  destroyCurrentSession,
  setSessionCookie,
} from "@/server/auth/session";
import { verifyPassword } from "@/server/auth/password";

describe("auth actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it("sets a fresh session cookie after successful sign-in", async () => {
    const expiresAt = new Date(Date.now() + 60_000);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user_1",
      name: "Demo Owner",
      email: "owner@example.local",
      passwordHash: "hash",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(verifyPassword).mockResolvedValue(true);
    vi.mocked(createSession).mockResolvedValue({
      token: "fresh-session-token",
      expiresAt,
    });
    const formData = new FormData();
    formData.set("email", "owner@example.local");
    formData.set("password", "password");
    formData.set("returnPath", "/services");

    await expect(signInAction(formData)).rejects.toThrow(
      "NEXT_REDIRECT:/services",
    );
    expect(setSessionCookie).toHaveBeenCalledWith(
      "fresh-session-token",
      expiresAt,
    );
  });

  it("does not expose a public demo entry when access is disabled", async () => {
    vi.mocked(getPublicDemoAvailability).mockResolvedValue({
      kind: "disabled",
      message: "Public demo access is disabled.",
    });

    await expect(publicDemoSignInAction()).rejects.toThrow(
      "NEXT_REDIRECT:/signin",
    );
    expect(createSession).not.toHaveBeenCalled();
  });

  it("refuses public demo entry until real healthy evidence is available", async () => {
    vi.mocked(getPublicDemoAvailability).mockResolvedValue({
      kind: "unavailable",
      message: "Public demo is waiting for a recent real successful Owner/Admin manual check.",
      operatorHint: "Run one manual check.",
    });

    await expect(publicDemoSignInAction()).rejects.toThrow(
      "NEXT_REDIRECT:/signin?demo=unavailable",
    );
    expect(createSession).not.toHaveBeenCalled();
  });

  it("creates a normal session only for the server-selected public demo Viewer", async () => {
    const expiresAt = new Date(Date.now() + 60_000);
    vi.mocked(getPublicDemoAvailability).mockResolvedValue({
      kind: "available",
      message: "Read-only public demo is ready.",
      viewerUserId: "public_viewer_user",
      workspaceId: "public_workspace",
      workspaceSlug: "public-recruiter-demo",
      latestHealthyCheckedAt: new Date(),
    });
    vi.mocked(createSession).mockResolvedValue({
      token: "public-demo-session",
      expiresAt,
    });

    await expect(publicDemoSignInAction()).rejects.toThrow(
      "NEXT_REDIRECT:/",
    );
    expect(createSession).toHaveBeenCalledWith("public_viewer_user");
    expect(setSessionCookie).toHaveBeenCalledWith(
      "public-demo-session",
      expiresAt,
    );
  });
});
