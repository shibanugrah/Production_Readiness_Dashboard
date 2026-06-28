import { WorkspaceRole } from "@prisma/client";

import { prisma } from "@/server/db";
import { getCurrentSession } from "@/server/auth/session";
import { WorkspaceContext } from "@/server/workspace-context";

export type AuthenticatedWorkspaceContext = WorkspaceContext & {
  user: {
    id: string;
    name: string;
    email: string;
  };
  workspace: {
    id: string;
    name: string;
    slug: string;
  };
  role: WorkspaceRole;
};

export async function getCurrentUser() {
  const session = await getCurrentSession();

  return session?.user ?? null;
}

export async function getCurrentWorkspaceContext(
  workspaceSlug = "portfolio-operations",
): Promise<AuthenticatedWorkspaceContext | null> {
  const session = await getCurrentSession();

  if (!session) {
    return null;
  }

  const membership = await prisma.workspaceMember.findFirst({
    where: {
      userId: session.userId,
      workspace: { slug: workspaceSlug },
    },
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  const resolvedMembership =
    membership ??
    (workspaceSlug === "portfolio-operations"
      ? await resolveOnlyWorkspaceMembership(session.userId)
      : null);

  if (!resolvedMembership) {
    return null;
  }

  return {
    workspaceId: resolvedMembership.workspaceId,
    userId: resolvedMembership.userId,
    user: resolvedMembership.user,
    workspace: resolvedMembership.workspace,
    role: resolvedMembership.role,
  };
}

async function resolveOnlyWorkspaceMembership(userId: string) {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    take: 2,
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return memberships.length === 1 ? memberships[0] : null;
}
