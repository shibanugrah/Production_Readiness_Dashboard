import { ServiceStatus } from "@prisma/client";

import { AuthenticatedShell } from "@/components/dashboard/authenticated-shell";
import { formatHttpStatus, formatLatency, formatRelativeTime } from "@/components/dashboard/format";
import { RunChecksControl } from "@/components/dashboard/local-actions";
import {
  CompactTable,
  EmptyState,
  MetricCard,
  PageHeader,
  Panel,
  TextLink,
} from "@/components/dashboard/primitives";
import { ServiceStatusCard } from "@/components/dashboard/service-components";
import { CheckResultBadge } from "@/components/dashboard/status";
import { canRunChecks } from "@/server/auth/permissions";
import { isLocalDemoActionsEnabled } from "@/server/dashboard/local-demo";
import { getOverviewSummary } from "@/server/dashboard/read-models";

export default async function OverviewPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const summary = await getOverviewSummary();

  if (!summary) {
    return (
      <AuthenticatedShell>
        <EmptyState
          title="No workspace found"
          description="Your authenticated account is not a member of a workspace."
        />
      </AuthenticatedShell>
    );
  }

  const checksResult =
    typeof params.checks === "string" ? params.checks : undefined;

  return (
    <AuthenticatedShell>
      <div className="space-y-5">
        <PageHeader
          title="Overview"
          description="Current readiness is calculated from active services and persisted health-check evidence."
          actions={
            <RunChecksControl
              enabled={isLocalDemoActionsEnabled() && canRunChecks(summary)}
              returnPath="/"
              result={checksResult}
            />
          }
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Overall readiness"
            value={summary.readiness}
            detail="Derived from active service status"
            tone={
              summary.readiness === "Ready"
                ? "green"
                : summary.readiness === "Needs Attention"
                  ? "amber"
                  : "rose"
            }
          />
          <MetricCard
            label="Healthy active services"
            value={`${summary.counts[ServiceStatus.HEALTHY]} / ${summary.activeServiceCount}`}
            detail="From persisted checks"
            tone="green"
          />
          <MetricCard
            label="Failed checks"
            value={summary.failedCheckCount}
            detail={summary.rangeLabel}
            tone={summary.failedCheckCount > 0 ? "rose" : "slate"}
          />
          <MetricCard
            label="Deployment evidence"
            value="Not connected"
            detail="No deployment integration yet"
            tone="blue"
          />
        </div>

        {summary.services.length === 0 ? (
          <EmptyState
            title="No services registered"
            description="Seed the database or add a local demo service to begin monitoring."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {summary.services.map((service) => (
              <ServiceStatusCard key={service.id} service={service} />
            ))}
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <Panel title="Recent Failed Checks" action={<TextLink href="/services">View services</TextLink>}>
            <CompactTable
              minWidth="760px"
              columns={[
                { key: "service", header: "Service", width: "24%" },
                { key: "result", header: "Result", width: "18%" },
                { key: "http", header: "HTTP", width: "12%" },
                { key: "latency", header: "Latency", width: "14%" },
                { key: "when", header: "When", width: "16%" },
                { key: "message", header: "Message", width: "16%" },
              ]}
              empty={
                <EmptyState
                  title="No failed checks in the selected range"
                  description="Failures will appear here after the runner records them."
                />
              }
              rows={summary.failedChecks.map((check) => ({
                service: (
                  <TextLink href={`/services/${check.service.id}`}>
                    {check.service.name}
                  </TextLink>
                ),
                result: <CheckResultBadge status={check.status} />,
                http: <span>{formatHttpStatus(check.httpStatus)}</span>,
                latency: <span>{formatLatency(check.responseTimeMs)}</span>,
                when: <span>{formatRelativeTime(check.checkedAt)}</span>,
                message: (
                  <span title={check.message ?? "No message"} className="block truncate text-slate-600">
                    {check.message ?? "No message"}
                  </span>
                ),
              }))}
            />
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-1">
            <Panel title="Operational Events" action={<TextLink href="/events">View all events</TextLink>}>
              {summary.operationalEvents.length === 0 ? (
                <EmptyState
                  title="No operational events received yet"
                  description="Webhook, job, deployment, and migration events are not connected in this phase."
                />
              ) : (
                <div className="space-y-3">
                  {summary.operationalEvents.map((event) => (
                    <div key={event.id} className="rounded-md border border-slate-200 p-3">
                      <p className="text-sm font-semibold text-slate-900">{event.message}</p>
                      <p className="mt-1 text-xs font-medium text-slate-500">
                        {event.type} - {formatRelativeTime(event.occurredAt)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
            <Panel title="Deployment Evidence">
              <EmptyState
                title="Deployment integration not connected"
                description="No readiness percentage, release history, or deployment actors are available yet."
              />
            </Panel>
          </div>
        </div>
      </div>
    </AuthenticatedShell>
  );
}
