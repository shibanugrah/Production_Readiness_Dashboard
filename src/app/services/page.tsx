import { ServiceStatus } from "@prisma/client";

import { AuthenticatedShell } from "@/components/dashboard/authenticated-shell";
import { formatLatency, formatRelativeTime } from "@/components/dashboard/format";
import { AddServicePanel, RunChecksControl } from "@/components/dashboard/local-actions";
import { DataTable, EmptyState, MetricCard, PageHeader, TextLink } from "@/components/dashboard/primitives";
import { StatusBadge } from "@/components/dashboard/status";
import { canManageServices, canRunChecks } from "@/server/auth/permissions";
import { isLocalDemoActionsEnabled } from "@/server/dashboard/local-demo";
import { getServiceListReadModel } from "@/server/dashboard/read-models";

export default async function ServicesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const query = typeof params.q === "string" ? params.q : "";
  const environment = typeof params.environment === "string" ? params.environment : "all";
  const status = typeof params.status === "string" ? params.status : "all";
  const checksResult = typeof params.checks === "string" ? params.checks : undefined;
  const serviceResult = typeof params.service === "string" ? params.service : undefined;
  const model = await getServiceListReadModel({ query, environment, status });

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
        title="Services"
        description="Monitor registered services using persisted health checks and current service state."
        actions={
          <RunChecksControl
            enabled={isLocalDemoActionsEnabled() && canRunChecks(model)}
            returnPath="/services"
            result={checksResult}
          />
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Active services" value={model.services.filter((service) => service.isActive).length} />
        <MetricCard label="Healthy" value={model.counts[ServiceStatus.HEALTHY]} tone="green" />
        <MetricCard label="Degraded" value={model.counts[ServiceStatus.DEGRADED]} tone="amber" />
        <MetricCard label="Down" value={model.counts[ServiceStatus.DOWN]} tone="rose" />
      </div>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <form className="grid gap-3 md:grid-cols-[1fr_180px_180px_auto]" action="/services">
            <input
              name="q"
              defaultValue={query}
              placeholder="Search services by name or slug..."
              className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            />
            <select
              name="environment"
              defaultValue={environment}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="all">All environments</option>
              {model.environments.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select
              name="status"
              defaultValue={status}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="all">All statuses</option>
              {Object.values(ServiceStatus).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <button className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Apply
            </button>
          </form>
        </div>
        <div className="p-4">
          <DataTable
            headers={[
              "Service",
              "Environment",
              "Status",
              "Base URL",
              "Health path",
              "Expected version",
              "Last checked",
              "Last healthy",
              "Latest latency",
              "Action",
            ]}
            empty={
              <EmptyState
                title="No matching services"
                description="Adjust filters or add a local demo service."
              />
            }
            rows={model.filteredServices.map((service) => [
              <div key="name">
                <p className="font-medium text-slate-950">{service.name}</p>
                <p className="text-xs text-slate-500">{service.slug}</p>
                {!service.isActive ? (
                  <p className="mt-1 text-xs font-medium text-slate-500">Inactive</p>
                ) : null}
              </div>,
              <span key="environment">{service.environment}</span>,
              <StatusBadge key="status" status={service.displayStatus} />,
              <span key="base" className="break-all text-xs">
                {service.baseUrl}
              </span>,
              <span key="path" className="text-xs">
                {service.healthPath}
              </span>,
              <span key="version">{service.expectedVersion ?? "Not set"}</span>,
              <span key="checked">{formatRelativeTime(service.lastCheckedAt)}</span>,
              <span key="healthy">{formatRelativeTime(service.lastHealthyAt)}</span>,
              <span key="latency">{formatLatency(service.latestCheck?.responseTimeMs)}</span>,
              <TextLink key="action" href={`/services/${service.id}`}>
                View
              </TextLink>,
            ])}
          />
        </div>
      </section>

      <AddServicePanel
        enabled={isLocalDemoActionsEnabled() && canManageServices(model)}
        result={serviceResult}
      />
    </div>
    </AuthenticatedShell>
  );
}
