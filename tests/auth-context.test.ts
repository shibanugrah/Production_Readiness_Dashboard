import { WorkspaceRole } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

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
    },
  },
}));

describe("authenticated workspace context", () => {
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
});
