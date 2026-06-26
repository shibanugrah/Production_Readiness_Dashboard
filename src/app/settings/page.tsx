import { AuthenticatedShell } from "@/components/dashboard/authenticated-shell";
import { EmptyState, PageHeader, Panel } from "@/components/dashboard/primitives";

export default function SettingsPage() {
  return (
    <AuthenticatedShell>
    <div className="space-y-5">
      <PageHeader
        title="Settings"
        description="Workspace and operator settings are not connected yet."
      />
      <Panel title="Settings">
        <EmptyState
          title="Settings unavailable"
          description="Authentication, invitations, notification rules, and workspace administration are outside this phase."
        />
      </Panel>
    </div>
    </AuthenticatedShell>
  );
}
