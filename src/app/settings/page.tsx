import { AuthenticatedShell } from "@/components/dashboard/authenticated-shell";
import { formatTimestamp } from "@/components/dashboard/format";
import {
  CompactTable,
  EmptyState,
  PageHeader,
  Panel,
  TruncatedText,
} from "@/components/dashboard/primitives";
import {
  getSchedulerMonitoringState,
  getSettingsReadModel,
} from "@/server/dashboard/read-models";

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
  const schedulerState = model
    ? getSchedulerMonitoringState(
        model.latestScheduledRun,
        model.latestScheduledRun
          ? formatTimestamp(model.latestScheduledRun.startedAt)
          : undefined,
      )
    : null;

  return (
    <AuthenticatedShell>
    <div className="space-y-5">
      <PageHeader
        title="Settings"
        description="Workspace and operator settings are not connected yet."
      />
      {model ? (
        <>
        <Panel title="Scheduler Verification">
          {schedulerState ? (
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">
                  {schedulerState.label}
                </p>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  Derived from persisted scheduled health-check runs.
                </p>
              </div>
              {model.latestScheduledRun ? (
                <div className="grid gap-3 text-sm md:grid-cols-5">
                  <div>
                    <p className="font-semibold text-slate-500">Checked</p>
                    <p className="mt-1 font-bold text-slate-950">
                      {model.latestScheduledRun.checkedCount}
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-500">Healthy</p>
                    <p className="mt-1 font-bold text-emerald-600">
                      {model.latestScheduledRun.healthyCount}
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-500">Degraded</p>
                    <p className="mt-1 font-bold text-amber-600">
                      {model.latestScheduledRun.degradedCount}
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-500">Down</p>
                    <p className="mt-1 font-bold text-rose-600">
                      {model.latestScheduledRun.downCount}
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-500">Skipped</p>
                    <p className="mt-1 font-bold text-slate-600">
                      {model.latestScheduledRun.skippedCount}
                    </p>
                  </div>
                </div>
              ) : null}
              <p className="text-xs font-medium text-slate-500">
                Setup reference: docs/runbooks/n8n-scheduled-health-check-setup.md
              </p>
            </div>
          ) : null}
        </Panel>
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
        </>
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
