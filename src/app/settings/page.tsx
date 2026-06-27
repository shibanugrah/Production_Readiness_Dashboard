import { AuthenticatedShell } from "@/components/dashboard/authenticated-shell";
import { formatTimestamp } from "@/components/dashboard/format";
import {
  CompactTable,
  EmptyState,
  PageHeader,
  Panel,
  TruncatedText,
} from "@/components/dashboard/primitives";
import { getSettingsReadModel } from "@/server/dashboard/read-models";

function auditActionLabel(action: string) {
  if (action === "SERVICE_CREATED") {
    return "Created";
  }

  if (action === "SERVICE_UPDATED") {
    return "Updated";
  }

  if (action === "SERVICE_DEACTIVATED") {
    return "Deactivated";
  }

  if (action === "SERVICE_REACTIVATED") {
    return "Reactivated";
  }

  return action;
}

export default async function SettingsPage() {
  const model = await getSettingsReadModel();

  return (
    <AuthenticatedShell>
    <div className="space-y-5">
      <PageHeader
        title="Settings"
        description="Workspace and operator settings are not connected yet."
      />
      {model ? (
        <Panel title="Audit Log">
          <CompactTable
            minWidth="760px"
            columns={[
              { key: "time", header: "Time", width: "22%" },
              { key: "actor", header: "Actor", width: "28%" },
              { key: "action", header: "Action", width: "20%" },
              { key: "resource", header: "Resource", width: "30%" },
            ]}
            empty={
              <EmptyState
                title="No service-management audit entries"
                description="Service create, update, deactivate, and reactivate actions will appear here."
              />
            }
            rows={model.auditLogs.map((entry) => ({
              time: <span>{formatTimestamp(entry.createdAt)}</span>,
              actor: (
                <div className="min-w-0">
                  <span className="block truncate font-semibold text-slate-800">
                    {entry.actorUser.name}
                  </span>
                  <TruncatedText value={entry.actorUser.email} className="text-xs text-slate-500" />
                </div>
              ),
              action: <span className="font-semibold text-slate-800">{auditActionLabel(entry.action)}</span>,
              resource: <TruncatedText value={entry.resourceId} className="text-slate-600" />,
            }))}
          />
        </Panel>
      ) : null}
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
