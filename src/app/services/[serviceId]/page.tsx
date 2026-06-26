import { notFound } from "next/navigation";

import { AuthenticatedShell } from "@/components/dashboard/authenticated-shell";
import {
  formatHttpStatus,
  formatLatency,
  formatRelativeTime,
  formatTimestamp,
} from "@/components/dashboard/format";
import { RunChecksControl } from "@/components/dashboard/local-actions";
import {
  DataTable,
  EmptyState,
  MetricCard,
  PageHeader,
  Panel,
  TextLink,
} from "@/components/dashboard/primitives";
import {
  statusDescription,
  StatusHistoryStrip,
} from "@/components/dashboard/service-components";
import { CheckResultBadge, StatusBadge } from "@/components/dashboard/status";
import { canRunChecks } from "@/server/auth/permissions";
import { isLocalDemoActionsEnabled } from "@/server/dashboard/local-demo";
import { getServiceDetailReadModel } from "@/server/dashboard/read-models";

export default async function ServiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ serviceId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { serviceId } = await params;
  const query = (await searchParams) ?? {};
  const checksResult = typeof query.checks === "string" ? query.checks : undefined;
  const model = await getServiceDetailReadModel(serviceId);

  if (!model) {
    notFound();
  }

  const { service, latestCheck, latestFailedCheck, history } = model;

  return (
    <AuthenticatedShell>
    <div className="space-y-5">
      <PageHeader
        eyebrow={
          <>
            <TextLink href="/services">Services</TextLink>
            <span className="text-slate-400"> / </span>
            <span className="text-slate-600">{service.name}</span>
          </>
        }
        title={service.name}
        description={`${service.environment} service monitored at ${service.healthPath}`}
        actions={
          <RunChecksControl
            enabled={isLocalDemoActionsEnabled() && canRunChecks(model)}
            returnPath={`/services/${service.id}`}
            result={checksResult}
          />
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard
          label="Current status"
          value={<StatusBadge status={service.displayStatus} />}
          detail={statusDescription(service.displayStatus)}
          tone="blue"
        />
        <MetricCard
          label="Latest latency"
          value={formatLatency(latestCheck?.responseTimeMs)}
          detail="From the latest persisted check"
        />
        <MetricCard
          label="Last checked"
          value={formatRelativeTime(service.lastCheckedAt)}
          detail={formatTimestamp(service.lastCheckedAt)}
        />
        <MetricCard
          label="Last healthy"
          value={formatRelativeTime(service.lastHealthyAt)}
          detail={formatTimestamp(service.lastHealthyAt)}
          tone="green"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.1fr_1fr]">
        <Panel title="Current Status">
          <dl className="grid gap-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Service</dt>
              <dd className="font-medium text-slate-900">{service.name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Environment</dt>
              <dd>{service.environment}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Active</dt>
              <dd>{service.isActive ? "Yes" : "No"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Expected version</dt>
              <dd>{service.expectedVersion ?? "Not set"}</dd>
            </div>
          </dl>
          <div className="mt-5 rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-950">
                Latest Check Result
              </p>
              {latestCheck ? <CheckResultBadge status={latestCheck.status} /> : null}
            </div>
            {latestCheck ? (
              <dl className="mt-4 grid gap-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Checked</dt>
                  <dd>{formatRelativeTime(latestCheck.checkedAt)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">HTTP status</dt>
                  <dd>{formatHttpStatus(latestCheck.httpStatus)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Latency</dt>
                  <dd>{formatLatency(latestCheck.responseTimeMs)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Version</dt>
                  <dd>{latestCheck.observedVersion ?? "Not reported"}</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-3 text-sm text-slate-600">No checks yet.</p>
            )}
          </div>
        </Panel>

        <Panel title="Health Check History">
          <StatusHistoryStrip checks={history} />
          <div className="mt-5">
            <DataTable
              headers={["Checked", "Result", "HTTP", "Latency", "Version", "Migration", "Message"]}
              empty={
                <EmptyState
                  title="No checks recorded"
                  description="Run local checks to create persisted health-check history."
                />
              }
              rows={history.slice(0, 8).map((check) => [
                <span key="checked">{formatRelativeTime(check.checkedAt)}</span>,
                <CheckResultBadge key="result" status={check.status} />,
                <span key="http">{formatHttpStatus(check.httpStatus)}</span>,
                <span key="latency">{formatLatency(check.responseTimeMs)}</span>,
                <span key="version">{check.observedVersion ?? "Not reported"}</span>,
                <span key="migration">{check.migrationVersion ?? "Not reported"}</span>,
                <span key="message">{check.message ?? "No message"}</span>,
              ])}
            />
          </div>
        </Panel>

        <Panel title="Latest Failure">
          {latestFailedCheck ? (
            <div className="space-y-3">
              <CheckResultBadge status={latestFailedCheck.status} />
              <dl className="grid gap-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">When</dt>
                  <dd>{formatTimestamp(latestFailedCheck.checkedAt)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">HTTP status</dt>
                  <dd>{formatHttpStatus(latestFailedCheck.httpStatus)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Latency</dt>
                  <dd>{formatLatency(latestFailedCheck.responseTimeMs)}</dd>
                </div>
              </dl>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                {latestFailedCheck.message ?? "No safe error message recorded."}
              </div>
            </div>
          ) : (
            <EmptyState
              title="No failures recorded"
              description="This service does not have a failed health-check row yet."
            />
          )}
        </Panel>
      </div>

      <Panel title="Configuration">
        <dl className="grid gap-4 text-sm md:grid-cols-2 xl:grid-cols-3">
          <div>
            <dt className="font-medium text-slate-500">Base URL</dt>
            <dd className="mt-1 break-all text-slate-900">{service.baseUrl}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Health endpoint</dt>
            <dd className="mt-1 text-slate-900">{service.healthPath}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Slug</dt>
            <dd className="mt-1 text-slate-900">{service.slug}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Environment</dt>
            <dd className="mt-1 text-slate-900">{service.environment}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Expected version</dt>
            <dd className="mt-1 text-slate-900">{service.expectedVersion ?? "Not set"}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Monitoring state</dt>
            <dd className="mt-1 text-slate-900">{service.isActive ? "Active" : "Inactive"}</dd>
          </div>
        </dl>
      </Panel>
    </div>
    </AuthenticatedShell>
  );
}
