import { AuthenticatedShell } from "@/components/dashboard/authenticated-shell";
import { CopyValueButton } from "@/components/dashboard/copy-value-button";
import { EventTriageControls } from "@/components/dashboard/event-triage-controls";
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
import { getEventsReadModel } from "@/server/dashboard/read-models";

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

  if (value === "ACKNOWLEDGED") {
    return "bg-amber-50 text-amber-700 border-amber-200";
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

function payloadPreview(value: unknown) {
  if (value === null || value === undefined) {
    return "No payload";
  }

  const serialized = JSON.stringify(value, null, 2);
  return serialized.length > 2_000
    ? `${serialized.slice(0, 2_000)}\n... truncated`
    : serialized;
}

function shortIdentifier(value: string) {
  return value.length <= 18 ? value : `${value.slice(0, 8)}...${value.slice(-6)}`;
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const model = await getEventsReadModel({
    type: typeof params.type === "string" ? params.type : undefined,
    severity: typeof params.severity === "string" ? params.severity : undefined,
    source: typeof params.source === "string" ? params.source : undefined,
    status: typeof params.status === "string" ? params.status : undefined,
    range: typeof params.range === "string" ? params.range : undefined,
    eventId: typeof params.eventId === "string" ? params.eventId : undefined,
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
          title="Events"
          description="Operational events are persisted from authenticated, workspace-scoped ingestion keys."
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Open events"
            value={model.openCount}
            detail="Persisted unresolved event records"
            tone={model.openCount > 0 ? "blue" : "slate"}
          />
          <MetricCard
            label="High severity"
            value={model.highSeverityCount}
            detail="Severity ERROR"
            tone={model.highSeverityCount > 0 ? "rose" : "slate"}
          />
          <MetricCard
            label="Recent failures"
            value={model.recentFailuresCount}
            detail="ERROR events in the last 24 hours"
            tone={model.recentFailuresCount > 0 ? "rose" : "slate"}
          />
          <MetricCard
            label="Sources connected"
            value={model.sourceCount || "None"}
            detail={model.sourceCount ? "Sources with persisted events" : "No event sources connected"}
            tone={model.sourceCount ? "green" : "slate"}
          />
        </div>

        <form className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-100 md:grid-cols-3 xl:grid-cols-[repeat(5,minmax(0,1fr))_140px]">
            <label className="sr-only" htmlFor="event-type-filter">Type</label>
              <select id="event-type-filter" name="type" defaultValue={model.filters.type} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium shadow-sm">
                <option value="all">All types</option>
                {model.eventTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            <label className="sr-only" htmlFor="event-severity-filter">Severity</label>
              <select id="event-severity-filter" name="severity" defaultValue={model.filters.severity} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium shadow-sm">
                <option value="all">All severities</option>
                {model.severities.map((severity) => (
                  <option key={severity} value={severity}>{severity}</option>
                ))}
              </select>
            <label className="sr-only" htmlFor="event-source-filter">Source</label>
              <select id="event-source-filter" name="source" defaultValue={model.filters.source} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium shadow-sm">
                <option value="all">All sources</option>
                {model.sources.map((source) => (
                  <option key={source} value={source}>{source}</option>
                ))}
              </select>
            <label className="sr-only" htmlFor="event-status-filter">Status</label>
              <select id="event-status-filter" name="status" defaultValue={model.filters.status} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium shadow-sm">
                <option value="all">All statuses</option>
                {model.statuses.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            <label className="sr-only" htmlFor="event-range-filter">Range</label>
              <select id="event-range-filter" name="range" defaultValue={model.filters.range} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium shadow-sm">
                <option value="all">All time</option>
                <option value="24h">Last 24 hours</option>
                <option value="7d">Last 7 days</option>
              </select>
            <div>
              <button type="submit" className="inline-flex h-10 w-full items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm shadow-blue-100 hover:bg-blue-700">
                Apply filters
              </button>
            </div>
          </form>

        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
          <Panel title="Operational Events">
            <CompactTable
              minWidth="100%"
              columns={[
                { key: "event", header: "Event", width: "22%" },
                { key: "service", header: "Service", width: "14%" },
                { key: "type", header: "Type", width: "13%" },
                { key: "severity", header: "Severity", width: "10%" },
                { key: "status", header: "Status", width: "10%" },
                { key: "time", header: "Occurred", width: "11%" },
                { key: "source", header: "Source", width: "11%" },
                { key: "reference", header: "Action", width: "9%" },
              ]}
              empty={
                <EmptyState
                  title="No operational events received yet."
                  description="Authenticated ingestion requests will appear here after a source sends real events."
                />
              }
              rows={model.events.map((event) => ({
                event: (
                  <div className="min-w-0">
                    <TruncatedText value={event.message} className="font-semibold text-slate-900" />
                    <TruncatedText value={event.errorMessage ?? event.externalReference ?? "No reference"} className="text-xs font-medium text-slate-500" />
                  </div>
                ),
                service: event.service ? (
                  <TextLink href={`/services/${event.service.id}`}>{event.service.name}</TextLink>
                ) : (
                  <span className="text-slate-500">None</span>
                ),
                type: <span>{event.type}</span>,
                severity: <Badge value={event.severity} />,
                status: <Badge value={event.status} />,
                time: <span>{formatRelativeTime(event.occurredAt)}</span>,
                source: <TruncatedText value={event.source} className="font-semibold text-slate-800" />,
                reference: event.externalReference ? (
                  <TextLink href={`/events?eventId=${event.id}`}>
                    View
                  </TextLink>
                ) : event.incident ? (
                  <TextLink href={`/incidents?incidentId=${event.incident.id}`}>
                    Incident
                  </TextLink>
                ) : (
                  <TextLink href={`/events?eventId=${event.id}`}>
                    Details
                  </TextLink>
                ),
              }))}
            />
          </Panel>

          <Panel title="Event Detail">
            {model.selectedEvent ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-slate-950">
                    {model.selectedEvent.message}
                  </p>
                  <p className="mt-1 text-xs font-medium text-slate-500">
                    {formatTimestamp(model.selectedEvent.occurredAt)}
                  </p>
                </div>
                <dl className="grid gap-3 text-sm">
                  <div>
                    <dt className="font-semibold text-slate-500">Source</dt>
                    <dd className="mt-1 font-medium text-slate-900">{model.selectedEvent.source}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-500">Type</dt>
                    <dd className="mt-1 font-medium text-slate-900">{model.selectedEvent.type}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-500">Linked service</dt>
                    <dd className="mt-1 font-medium text-slate-900">
                      {model.selectedEvent.service?.name ?? "None"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-500">External reference</dt>
                    <dd className="mt-1 break-all font-medium text-slate-900">
                      {model.selectedEvent.externalReference ?? "None"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-500">Incident</dt>
                    <dd className="mt-1 font-medium text-slate-900">
                      {model.selectedEvent.incident ? (
                        <TextLink href={`/incidents?incidentId=${model.selectedEvent.incident.id}`}>
                          {model.selectedEvent.incident.title}
                        </TextLink>
                      ) : (
                        "None"
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-500">Acknowledged</dt>
                    <dd className="mt-1 font-medium text-slate-900">
                      {formatTimestamp(model.selectedEvent.acknowledgedAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-500">Resolved</dt>
                    <dd className="mt-1 font-medium text-slate-900">
                      {formatTimestamp(model.selectedEvent.resolvedAt)}
                    </dd>
                  </div>
                </dl>
                {model.selectedEvent.resolutionNote ? (
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
                    {model.selectedEvent.resolutionNote}
                  </div>
                ) : null}
                {model.selectedEvent.errorMessage ? (
                  <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">
                    {model.selectedEvent.errorMessage}
                  </div>
                ) : null}
                <details className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-slate-900">
                    Technical metadata
                  </summary>
                  <dl className="mt-3 grid gap-3 text-sm">
                    <div>
                      <dt className="font-semibold text-slate-500">Idempotency key</dt>
                      <dd className="mt-1 flex min-w-0 items-center gap-2">
                        <code
                          title={model.selectedEvent.idempotencyKey}
                          className="min-w-0 truncate rounded bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                        >
                          {shortIdentifier(model.selectedEvent.idempotencyKey)}
                        </code>
                        <CopyValueButton value={model.selectedEvent.idempotencyKey} />
                      </dd>
                    </div>
                  </dl>
                </details>
                <div className="border-t border-slate-200 pt-4">
                  <p className="mb-3 text-sm font-semibold text-slate-950">
                    Triage
                  </p>
                  {model.canTriageEvents ? (
                    <EventTriageControls
                      eventId={model.selectedEvent.id}
                      status={model.selectedEvent.status}
                      incidentId={model.selectedEvent.incident?.id}
                    />
                  ) : (
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-600">
                      Viewer access is read-only.
                    </div>
                  )}
                </div>
                <div>
                  <p className="mb-2 text-sm font-semibold text-slate-950">
                    Safe payload preview
                  </p>
                  <pre className="max-h-56 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-700">
                    {payloadPreview(model.selectedEvent.metadata)}
                  </pre>
                </div>
              </div>
            ) : (
              <EmptyState
                title="No event selected"
                description="Select an event from the table to inspect its persisted metadata."
              />
            )}
          </Panel>
        </div>
      </div>
    </AuthenticatedShell>
  );
}
