export type WorkspaceContext = {
  workspaceId: string;
  userId?: string;
};

// Test helper for repository-level unit tests. Production dashboard routes
// derive this shape from the authenticated session and WorkspaceMember rows.
export function createTrustedWorkspaceContext(
  workspaceId: string,
  userId?: string,
): WorkspaceContext {
  return { workspaceId, userId };
}
