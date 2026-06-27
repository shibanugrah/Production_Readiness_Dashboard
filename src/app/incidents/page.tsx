import { AuthenticatedShell } from "@/components/dashboard/authenticated-shell";
import { ResolveIncidentControl } from "@/components/dashboard/event-triage-controls";
import { formatRelativeTime, formatTimestamp } from "@/components/dashboard/format";
import {
  CompactTable,
  EmptyState,
  MetricCard,
  PageHeader,
  Panel,
  TextLink,
  TruncatedText,
} from "@/components/dashboard/primitives";
import { getIncidentsReadModel } from "@/server/dashboard/read-models";

function badgeClass(value: string) {
  if (value === "ERROR") {
    return "bg-rose-50 text-rose-700 border-rose-200";
  }

  if (value === "WARNING") {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }

  if (value === "OPEN") {
    return "bg-blue-50 text-blue-700 border-blue-200";
  }

  if (value === "RESOLVED") {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }

  return "bg-slate-50 text-slate-700 border-slate-200";
}

function Badge({ value }: { value: string }) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${badgeClass(value)}`}>
      {value}
    </span>
  );
}

function auditSummary(metadata: unknown) {
  if (metadata && typeof metadata === "object" && "summary" in metadata) {
    const value = (metadata as { summary?: unknown }).summary;
    return typeof value === "string" ? value : "Audit entry";
  }

  return "Audit entry";
}

export default async function IncidentsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const model = await getIncidentsReadModel({
    status: typeof params.status === "string" ? params.status : undefined,
    severity: typeof params.severity === "string" ? params.severity : undefined,
    range: typeof params.range === "string" ? params.range : undefined,
    incidentId: typeof params.incidentId === "string" ? params.incidentId : undefined,
  });

  if (!model) {
    return (
      <AuthenticatedShell>
        <EmptyState
          title="No workspace found"
          description="Your authenticated account is not a member of a workspace."
        />
      </AuthenticatedShell>
    );
  }

  return (
    <AuthenticatedShell>
      <div className="space-y-5">
        <PageHeader
          title="Incidents"
          description="Incidents are manual escalations from real operational events."
        />

        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard
            label="Open incidents"
            value={model.openCount}
            detail="Persisted incident records"
            tone={model.openCount > 0 ? "blue" : "slate"}
          />
          <MetricCard
            label="High-severity open"
            value={model.highSeverityOpenCount}
            detail="Open severity ERROR incidents"
            tone={model.highSeverityOpenCount > 0 ? "rose" : "slate"}
          />
          <MetricCard
            label="Resolved recently"
            value={model.resolvedRecentCount}
            detail={model.filters.range === "7d" ? "Last 7 days" : "Last 24 hours"}
            tone="green"
          />
        </div>

        <form className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-100 md:grid-cols-[1fr_1fr_1fr_140px]">
            <label className="sr-only" htmlFor="incident-status-filter">Status</label>
              <select id="incident-status-filter" name="status" defaultValue={model.filters.status} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium shadow-sm">
                <option value="all">All statuses</option>
                {model.statuses.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            <label className="sr-only" htmlFor="incident-severity-filter">Severity</label>
              <select id="incident-severity-filter" name="severity" defaultValue={model.filters.severity} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium shadow-sm">
                <option value="all">All severities</option>
                {model.severities.map((severity) => (
                  <option key={severity} value={severity}>{severity}</option>
                ))}
              </select>
            <label className="sr-only" htmlFor="incident-range-filter">Resolved range</label>
              <select id="incident-range-filter" name="range" defaultValue={model.filters.range} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium shadow-sm">
                <option value="24h">Last 24 hours</option>
                <option value="7d">Last 7 days</option>
              </select>
            <div>
              <button type="submit" className="inline-flex h-10 w-full items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm shadow-blue-100 hover:bg-blue-700">
                Apply filters
              </button>
            </div>
          </form>

        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
          <Panel title="Incident Records">
            <CompactTable
              minWidth="960px"
              columns={[
                { key: "id", header: "ID", width: "12%" },
                { key: "title", header: "Title", width: "24%" },
                { key: "service", header: "Service", width: "14%" },
                { key: "severity", header: "Severity", width: "10%" },
                { key: "status", header: "Status", width: "10%" },
                { key: "owner", header: "Owner", width: "12%" },
                { key: "started", header: "Started", width: "9%" },
                { key: "updated", header: "Updated", width: "9%" },
              ]}
              empty={
                <EmptyState
                  title="No incidents have been created from operational events yet."
                  description="Incidents will appear here only after an Owner or Admin escalates a real event."
                />
              }
              rows={model.incidents.map((incident) => ({
                id: (
                  <TextLink href={`/incidents?incidentId=${incident.id}`}>
                    {incident.id.slice(-8)}
                  </TextLink>
                ),
                title: <TruncatedText value={incident.title} className="font-semibold text-slate-800" />,
                service: incident.service ? (
                  <TextLink href={`/services/${incident.service.id}`}>{incident.service.name}</TextLink>
                ) : (
                  <span className="text-slate-500">None</span>
                ),
                severity: <Badge value={incident.severity} />,
                status: <Badge value={incident.status} />,
                owner: incident.ownerUser ? (
                  <TruncatedText value={incident.ownerUser.name} />
                ) : (
                  <span className="text-slate-500">Unassigned</span>
                ),
                started: <span>{formatRelativeTime(incident.startedAt)}</span>,
                updated: <span>{formatRelativeTime(incident.updatedAt)}</span>,
              }))}
            />
          </Panel>

          <Panel title="Incident Detail">
            {model.selectedIncident ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-slate-950">
                    {model.selectedIncident.title}
                  </p>
                  <p className="mt-1 text-xs font-medium text-slate-500">
                    Started {formatTimestamp(model.selectedIncident.startedAt)}
                  </p>
                </div>
                <dl className="grid gap-3 text-sm">
                  <div>
                    <dt className="font-semibold text-slate-500">Status</dt>
                    <dd className="mt-1"><Badge value={model.selectedIncident.status} /></dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-500">Severity</dt>
                    <dd className="mt-1"><Badge value={model.selectedIncident.severity} /></dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-500">Owner</dt>
                    <dd className="mt-1 font-medium text-slate-900">
                      {model.selectedIncident.ownerUser?.name ?? "Unassigned"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-500">Linked service</dt>
                    <dd className="mt-1 font-medium text-slate-900">
                      {model.selectedIncident.service?.name ?? "None"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-500">Source event</dt>
                    <dd className="mt-1 font-medium text-slate-900">
                      {model.selectedIncident.sourceEvent ? (
                        <TextLink href={`/events?eventId=${model.selectedIncident.sourceEvent.id}`}>
                          {model.selectedIncident.sourceEvent.message}
                        </TextLink>
                      ) : (
                        "None"
                      )}
                    </dd>
                  </div>
                </dl>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  {model.selectedIncident.summary}
                </div>
                {model.selectedIncident.resolutionNotes ? (
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
                    {model.selectedIncident.resolutionNotes}
                  </div>
                ) : null}
                {model.canTriageEvents && model.selectedIncident.status === "OPEN" ? (
                  <div className="border-t border-slate-200 pt-4">
                    <p className="mb-3 text-sm font-semibold text-slate-950">
                      Resolve Incident
                    </p>
                    <ResolveIncidentControl incidentId={model.selectedIncident.id} />
                  </div>
                ) : null}
                <div className="border-t border-slate-200 pt-4">
                  <p className="mb-3 text-sm font-semibold text-slate-950">Timeline</p>
                  {model.timeline.length ? (
                    <div className="space-y-3">
                      {model.timeline.map((entry) => (
                        <div key={entry.id} className="rounded-md border border-slate-200 p-3">
                          <p className="text-sm font-semibold text-slate-900">
                            {auditSummary(entry.metadataJson)}
                          </p>
                          <p className="mt-1 text-xs font-medium text-slate-500">
                            {entry.action} - {entry.actorUser.name} -{" "}
                            {formatRelativeTime(entry.createdAt)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm font-medium text-slate-500">
                      No audit entries recorded for this incident yet.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <EmptyState
                title="No incident selected"
                description="Select an incident to inspect its source event and audit timeline."
              />
            )}
          </Panel>
        </div>
      </div>
    </AuthenticatedShell>
  );
}
