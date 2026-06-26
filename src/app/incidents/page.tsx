import { AuthenticatedShell } from "@/components/dashboard/authenticated-shell";
import { EmptyState, PageHeader, Panel } from "@/components/dashboard/primitives";

export default function IncidentsPage() {
  return (
    <AuthenticatedShell>
    <div className="space-y-5">
      <PageHeader
        title="Incidents"
        description="Incident tracking is intentionally unavailable in this phase."
      />
      <Panel title="Incidents">
        <EmptyState
          title="Incident workflow not connected"
          description="No incident records, owners, escalation policies, or remediation workflows are implemented yet."
        />
      </Panel>
    </div>
    </AuthenticatedShell>
  );
}
