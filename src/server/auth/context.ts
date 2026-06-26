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

  if (!membership) {
    return null;
  }

  return {
    workspaceId: membership.workspaceId,
    userId: membership.userId,
    user: membership.user,
    workspace: membership.workspace,
    role: membership.role,
  };
}
