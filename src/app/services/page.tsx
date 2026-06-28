import { ServiceStatus } from "@prisma/client";

import { AuthenticatedShell } from "@/components/dashboard/authenticated-shell";
import { formatLatency, formatRelativeTime } from "@/components/dashboard/format";
import { AddServiceDrawer } from "@/components/dashboard/local-actions";
import {
  CompactTable,
  EmptyState,
  MetricCard,
  PageHeader,
  Panel,
  TextLink,
  TruncatedText,
} from "@/components/dashboard/primitives";
import { ServicesFilterBar } from "@/components/dashboard/services-controls";
import { StatusBadge } from "@/components/dashboard/status";
import { canManageServices } from "@/server/auth/permissions";
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
          description="Monitor and manage registered services."
          actions={
            <AddServiceDrawer
              enabled={canManageServices(model)}
              result={serviceResult}
            />
          }
        />

        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard
            label="Monitoring enabled"
            value={model.services.filter((service) => service.isActive).length}
            detail={`${model.services.length} registered`}
            tone="blue"
          />
          <MetricCard label="Healthy" value={model.counts[ServiceStatus.HEALTHY]} tone="green" />
          <MetricCard label="Degraded" value={model.counts[ServiceStatus.DEGRADED]} tone="amber" />
          <MetricCard label="Down" value={model.counts[ServiceStatus.DOWN]} tone="rose" />
        </div>

        <Panel
          title="Registered Services"
          action={
            <span className="text-sm font-medium text-slate-500">
              Showing {model.filteredServices.length} of {model.services.length}
            </span>
          }
        >
          <div className="mb-4">
            <ServicesFilterBar
              query={query}
              environment={environment}
              status={status}
              environments={model.environments}
            />
          </div>
          <CompactTable
            minWidth="1120px"
            columns={[
              { key: "service", header: "Service", width: "21%" },
              { key: "environment", header: "Environment", width: "11%" },
              { key: "status", header: "Status", width: "10%" },
              { key: "baseUrl", header: "Base URL", width: "16%" },
              { key: "healthPath", header: "Health Path", width: "11%" },
              { key: "expectedVersion", header: "Expected Version", width: "11%" },
              { key: "lastChecked", header: "Last Checked", width: "10%" },
              { key: "lastHealthy", header: "Last Healthy", width: "10%" },
              { key: "latestLatency", header: "Latest Latency", width: "10%" },
              { key: "action", header: "Action", width: "7%" },
            ]}
            empty={
              <EmptyState
                title="No matching services"
                description="Adjust filters or add a service."
              />
            }
            rows={model.filteredServices.map((service) => ({
              service: (
                <div className="min-w-0">
                  <TextLink href={`/services/${service.id}`}>
                    <span title={service.name} className="block truncate font-semibold">
                      {service.name}
                    </span>
                  </TextLink>
                  <TruncatedText value={`${service.slug} / ${service.baseUrl}`} className="mt-0.5 text-xs font-medium text-slate-500" />
                  {!service.isActive ? (
                    <p className="mt-1 text-xs font-semibold text-slate-500">Inactive</p>
                  ) : null}
                </div>
              ),
              environment: <span className="font-medium text-slate-700">{service.environment}</span>,
              status: <StatusBadge status={service.displayStatus} />,
              baseUrl: <TruncatedText value={service.baseUrl} className="text-xs font-medium text-slate-600" />,
              healthPath: <TruncatedText value={service.healthPath} className="text-xs font-medium text-slate-700" />,
              expectedVersion: <span>{service.expectedVersion ?? "Not set"}</span>,
              lastChecked: <span>{formatRelativeTime(service.lastCheckedAt)}</span>,
              lastHealthy: <span>{formatRelativeTime(service.lastHealthyAt)}</span>,
              latestLatency: <span>{formatLatency(service.latestCheck?.responseTimeMs)}</span>,
              action: (
                <TextLink href={`/services/${service.id}`}>
                  View
                </TextLink>
              ),
            }))}
          />
        </Panel>
      </div>
    </AuthenticatedShell>
  );
}
