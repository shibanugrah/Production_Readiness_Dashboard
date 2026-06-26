import { WorkspaceRole } from "@prisma/client";

import { AuthenticatedWorkspaceContext } from "@/server/auth/context";

export class PermissionDeniedError extends Error {
  constructor(message = "Permission denied.") {
    super(message);
    this.name = "PermissionDeniedError";
  }
}

const roleRank = {
  [WorkspaceRole.VIEWER]: 0,
  [WorkspaceRole.ADMIN]: 1,
  [WorkspaceRole.OWNER]: 2,
};

export function hasWorkspaceRole(
  context: Pick<AuthenticatedWorkspaceContext, "role">,
  minimumRole: WorkspaceRole,
) {
  return roleRank[context.role] >= roleRank[minimumRole];
}

export function assertWorkspaceRole(
  context: Pick<AuthenticatedWorkspaceContext, "role">,
  minimumRole: WorkspaceRole,
) {
  if (!hasWorkspaceRole(context, minimumRole)) {
    throw new PermissionDeniedError();
  }
}

export function canManageServices(context: Pick<AuthenticatedWorkspaceContext, "role">) {
  return hasWorkspaceRole(context, WorkspaceRole.ADMIN);
}

export function canRunChecks(context: Pick<AuthenticatedWorkspaceContext, "role">) {
  return hasWorkspaceRole(context, WorkspaceRole.ADMIN);
}

export function canManageWorkspace(context: Pick<AuthenticatedWorkspaceContext, "role">) {
  return hasWorkspaceRole(context, WorkspaceRole.OWNER);
}
