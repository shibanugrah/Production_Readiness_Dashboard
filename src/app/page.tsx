import { ServiceStatus } from "@prisma/client";

import { EmptyState, MetricCard, PageHeader, Panel, DataTable, TextLink } from "@/components/dashboard/primitives";
import { ServiceStatusCard } from "@/components/dashboard/service-components";
import { CheckResultBadge, StatusBadge } from "@/components/dashboard/status";
import { formatHttpStatus, formatLatency, formatRelativeTime } from "@/components/dashboard/format";
import { RunChecksControl } from "@/components/dashboard/local-actions";
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
      <EmptyState
        title="No workspace found"
        description="Seed the local database to create the Portfolio Operations workspace."
      />
    );
  }

  const checksResult =
    typeof params.checks === "string" ? params.checks : undefined;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Overview"
        description="Current readiness is calculated from active services and persisted health-check evidence."
        actions={
          <RunChecksControl
            enabled={isLocalDemoActionsEnabled()}
            returnPath="/"
            result={checksResult}
          />
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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
        <MetricCard label="Healthy" value={summary.counts[ServiceStatus.HEALTHY]} tone="green" />
        <MetricCard label="Degraded" value={summary.counts[ServiceStatus.DEGRADED]} tone="amber" />
        <MetricCard label="Down" value={summary.counts[ServiceStatus.DOWN]} tone="rose" />
        <MetricCard
          label="Failed checks"
          value={summary.failedCheckCount}
          detail={summary.rangeLabel}
          tone="slate"
        />
      </div>

      {summary.services.length === 0 ? (
        <EmptyState
          title="No services registered"
          description="Seed the database or add a local demo service to begin monitoring."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {summary.services.map((service) => (
            <ServiceStatusCard key={service.id} service={service} />
          ))}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Panel title="Recent Failed Checks" action={<TextLink href="/services">View services</TextLink>}>
          <DataTable
            headers={["Service", "Result", "HTTP", "Latency", "When", "Message"]}
            empty={
              <EmptyState
                title="No failed checks in the selected range"
                description="Failures will appear here after the runner records them."
              />
            }
            rows={summary.failedChecks.map((check) => [
              <TextLink key="service" href={`/services/${check.service.id}`}>
                {check.service.name}
              </TextLink>,
              <CheckResultBadge key="result" status={check.status} />,
              <span key="http">{formatHttpStatus(check.httpStatus)}</span>,
              <span key="latency">{formatLatency(check.responseTimeMs)}</span>,
              <span key="when">{formatRelativeTime(check.checkedAt)}</span>,
              <span key="message" className="text-slate-600">
                {check.message ?? "No message"}
              </span>,
            ])}
          />
        </Panel>

        <div className="space-y-4">
          <Panel title="Operational Events">
            {summary.operationalEvents.length === 0 ? (
              <EmptyState
                title="No operational events received yet"
                description="Webhook, job, deployment, and migration events are not connected in this phase."
              />
            ) : (
              <div className="space-y-3">
                {summary.operationalEvents.map((event) => (
                  <div key={event.id} className="rounded-md border border-slate-200 p-3">
                    <p className="text-sm font-medium text-slate-900">{event.message}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {event.type} · {formatRelativeTime(event.occurredAt)}
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
          <Panel title="Active Service State">
            <div className="grid gap-2">
              {summary.services
                .filter((service) => service.isActive)
                .map((service) => (
                  <div key={service.id} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2">
                    <span className="text-sm font-medium text-slate-800">{service.name}</span>
                    <StatusBadge status={service.displayStatus} />
                  </div>
                ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
