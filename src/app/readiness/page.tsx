import { AuthenticatedShell } from "@/components/dashboard/authenticated-shell";
import { EmptyState, PageHeader, Panel } from "@/components/dashboard/primitives";

export default function ReadinessPage() {
  return (
    <AuthenticatedShell>
    <div className="space-y-5">
      <PageHeader
        title="Readiness"
        description="Deployment readiness integrations are not connected yet."
      />
      <Panel title="Deployment Evidence">
        <EmptyState
          title="Deployment integration not connected"
          description="Readiness percentages, release history, deployment actors, and approval evidence are intentionally absent."
        />
      </Panel>
    </div>
    </AuthenticatedShell>
  );
}
