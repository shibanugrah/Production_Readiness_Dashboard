import { redirect } from "next/navigation";
import { ReactNode } from "react";

import { AppShell } from "@/components/dashboard/app-shell";
import { getCurrentWorkspaceContext } from "@/server/auth/context";

export async function AuthenticatedShell({ children }: { children: ReactNode }) {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    redirect("/signin");
  }

  return (
    <AppShell
      user={{
        name: context.user.name,
        email: context.user.email,
        role: context.role,
        workspaceName: context.workspace.name,
      }}
    >
      {children}
    </AppShell>
  );
}
