import { WorkspaceRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentWorkspaceContext } from "@/server/auth/context";
import { getCurrentSession } from "@/server/auth/session";
import { prisma } from "@/server/db";

vi.mock("@/server/auth/session", () => ({
  getCurrentSession: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    workspaceMember: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

describe("authenticated workspace context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.workspaceMember.findMany).mockResolvedValue([]);
  });

  it("returns null when no authenticated session exists", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);

    await expect(getCurrentWorkspaceContext()).resolves.toBeNull();
    expect(prisma.workspaceMember.findFirst).not.toHaveBeenCalled();
  });

  it("resolves workspace access and role from database membership", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue({
      id: "session_1",
      userId: "user_1",
      tokenHash: "hash",
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      updatedAt: new Date(),
      user: {
        id: "user_1",
        name: "Demo Admin",
        email: "admin@example.local",
        passwordHash: "not-returned-to-client",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValue({
      id: "member_1",
      workspaceId: "workspace_1",
      userId: "user_1",
      role: WorkspaceRole.ADMIN,
      createdAt: new Date(),
      updatedAt: new Date(),
      workspace: {
        id: "workspace_1",
        name: "Portfolio Operations",
        slug: "portfolio-operations",
      },
      user: {
        id: "user_1",
        name: "Demo Admin",
        email: "admin@example.local",
      },
    } as never);

    await expect(getCurrentWorkspaceContext()).resolves.toMatchObject({
      workspaceId: "workspace_1",
      userId: "user_1",
      role: WorkspaceRole.ADMIN,
      user: {
        email: "admin@example.local",
      },
    });
    expect(prisma.workspaceMember.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "user_1",
          workspace: { slug: "portfolio-operations" },
        },
      }),
    );
  });

  it("does not trust any session role without database membership", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue({
      id: "session_2",
      userId: "user_2",
      tokenHash: "hash",
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      updatedAt: new Date(),
      user: {
        id: "user_2",
        name: "Unmapped User",
        email: "unmapped@example.local",
        passwordHash: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValue(null);

    await expect(getCurrentWorkspaceContext()).resolves.toBeNull();
  });

  it("resolves a dedicated one-workspace public demo account without browser workspace input", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue({
      id: "session_public",
      userId: "public_viewer",
      tokenHash: "hash",
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      updatedAt: new Date(),
      user: {
        id: "public_viewer",
        name: "Public Demo Viewer",
        email: "public-viewer@example.invalid",
        passwordHash: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.workspaceMember.findMany).mockResolvedValue([
      {
        id: "member_public",
        workspaceId: "workspace_public",
        userId: "public_viewer",
        role: WorkspaceRole.VIEWER,
        createdAt: new Date(),
        updatedAt: new Date(),
        workspace: {
          id: "workspace_public",
          name: "Public Demo",
          slug: "public-recruiter-demo",
        },
        user: {
          id: "public_viewer",
          name: "Public Demo Viewer",
          email: "public-viewer@example.invalid",
        },
      },
    ] as never);

    await expect(getCurrentWorkspaceContext()).resolves.toMatchObject({
      workspaceId: "workspace_public",
      role: WorkspaceRole.VIEWER,
      workspace: {
        slug: "public-recruiter-demo",
      },
    });
    expect(prisma.workspaceMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "public_viewer" },
        take: 2,
      }),
    );
  });

  it("does not guess a workspace when the session user has ambiguous memberships", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue({
      id: "session_ambiguous",
      userId: "user_ambiguous",
      tokenHash: "hash",
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      updatedAt: new Date(),
      user: {
        id: "user_ambiguous",
        name: "Ambiguous User",
        email: "ambiguous@example.invalid",
        passwordHash: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.workspaceMember.findMany).mockResolvedValue([
      { id: "member_1" },
      { id: "member_2" },
    ] as never);

    await expect(getCurrentWorkspaceContext()).resolves.toBeNull();
  });
});
