export type TrustedWorkspaceContext = {
  workspaceId: string;
  userId?: string;
};

export function createTrustedWorkspaceContext(
  workspaceId: string,
  userId?: string,
): TrustedWorkspaceContext {
  return { workspaceId, userId };
}
