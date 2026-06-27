import { notFound } from "next/navigation";
import { ReactNode } from "react";

import { AuthenticatedShell } from "@/components/dashboard/authenticated-shell";
import {
  formatHttpStatus,
  formatLatency,
  formatRelativeTime,
  formatTimestamp,
} from "@/components/dashboard/format";
import { RunChecksControl } from "@/components/dashboard/local-actions";
import {
  CompactTable,
  EmptyState,
  MetricCard,
  Panel,
  TextLink,
  TruncatedText,
} from "@/components/dashboard/primitives";
import {
  SegmentedHealthHistoryStrip,
  statusDescription,
} from "@/components/dashboard/service-components";
import { CheckResultBadge, StatusBadge, statusTone } from "@/components/dashboard/status";
import { canRunChecks } from "@/server/auth/permissions";
import { isLocalDemoActionsEnabled } from "@/server/dashboard/local-demo";
import { getServiceDetailReadModel } from "@/server/dashboard/read-models";

function DetailRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: ReactNode;
  accent?: string;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-4 text-sm leading-5">
      <dt className="font-semibold text-slate-500">{label}</dt>
      <dd className={`min-w-0 font-semibold text-slate-900 ${accent ?? ""}`}>{value}</dd>
    </div>
  );
}

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
  const latestVersion =
    latestCheck?.observedVersion ?? service.expectedVersion ?? "Not set";

  return (
    <AuthenticatedShell>
      <div className="space-y-5">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <div className="mb-3 text-sm font-semibold leading-5">
              <TextLink href="/services">Services</TextLink>
              <span className="mx-2 text-slate-400">/</span>
              <span className="text-slate-600">{service.name}</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="truncate text-[28px] font-bold leading-[34px] text-slate-950">
                {service.name}
              </h1>
              <StatusBadge status={service.displayStatus} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                {service.environment}
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                Last checked {formatRelativeTime(service.lastCheckedAt)}
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                {service.isActive ? "Active monitoring" : "Inactive monitoring"}
              </span>
            </div>
          </div>
          <RunChecksControl
            enabled={isLocalDemoActionsEnabled() && canRunChecks(model)}
            returnPath={`/services/${service.id}`}
            result={checksResult}
            variant="secondary"
          />
        </header>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            label="Current status"
            value={<span className={statusTone(service.displayStatus)}>{service.displayStatus}</span>}
            detail={statusDescription(service.displayStatus)}
            tone={
              service.displayStatus === "HEALTHY"
                ? "green"
                : service.displayStatus === "DEGRADED"
                  ? "amber"
                  : service.displayStatus === "DOWN"
                    ? "rose"
                    : "slate"
            }
          />
          <MetricCard
            label="Latest latency"
            value={formatLatency(latestCheck?.responseTimeMs)}
            detail="Latest persisted check"
            tone="blue"
          />
          <MetricCard
            label="Last healthy"
            value={formatRelativeTime(service.lastHealthyAt)}
            detail={formatTimestamp(service.lastHealthyAt)}
            tone="green"
          />
          <MetricCard
            label="Version"
            value={latestVersion}
            detail={latestCheck?.observedVersion ? "Observed version" : "Expected version"}
            tone="blue"
          />
          <MetricCard
            label="Latest result"
            value={latestCheck ? latestCheck.status : "No result"}
            detail={latestCheck ? formatRelativeTime(latestCheck.checkedAt) : "No checks recorded"}
            tone={
              latestCheck?.status === "SUCCESS"
                ? "green"
                : latestCheck?.status === "DEGRADED"
                  ? "amber"
                  : latestCheck?.status === "FAILURE"
                    ? "rose"
                    : "slate"
            }
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[0.95fr_1.45fr_1fr]">
          <Panel title="1. Current Status / Metadata">
            <dl className="space-y-4">
              <DetailRow label="Service" value={service.name} />
              <DetailRow label="Environment" value={service.environment} />
              <DetailRow label="Health endpoint" value={service.healthPath} />
              <DetailRow label="Checks stored" value={history.length} />
              <DetailRow
                label="Current latency"
                value={formatLatency(latestCheck?.responseTimeMs)}
                accent={statusTone(service.displayStatus)}
              />
              <DetailRow label="Status since" value={formatRelativeTime(service.lastCheckedAt)} />
            </dl>
            <div className="mt-5 rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-950">Latest Check Result</p>
                {latestCheck ? <CheckResultBadge status={latestCheck.status} /> : null}
              </div>
              {latestCheck ? (
                <dl className="mt-4 space-y-3">
                  <DetailRow label="Checked" value={formatRelativeTime(latestCheck.checkedAt)} />
                  <DetailRow label="HTTP status" value={formatHttpStatus(latestCheck.httpStatus)} />
                  <DetailRow label="Latency" value={formatLatency(latestCheck.responseTimeMs)} />
                  <DetailRow label="Version" value={latestCheck.observedVersion ?? "Not reported"} />
                  <DetailRow label="Message" value={latestCheck.message ?? "No message"} />
                </dl>
              ) : (
                <p className="mt-3 text-sm font-medium text-slate-600">No checks yet.</p>
              )}
            </div>
          </Panel>

          <Panel title="2. Health Check History">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="grid grid-cols-[72px_1fr] gap-3">
                <div className="space-y-3 text-xs font-semibold leading-4">
                  <p className="text-emerald-600">Healthy</p>
                  <p className="text-orange-500">Degraded</p>
                  <p className="text-rose-500">Down</p>
                </div>
                <SegmentedHealthHistoryStrip checks={history} />
              </div>
            </div>
            <div className="mt-4">
              <CompactTable
                minWidth="620px"
                columns={[
                  { key: "checked", header: "Time", width: "23%" },
                  { key: "latency", header: "Latency", width: "16%" },
                  { key: "http", header: "HTTP", width: "14%" },
                  { key: "version", header: "Version", width: "20%" },
                  { key: "result", header: "Result", width: "18%" },
                ]}
                empty={
                  <EmptyState
                    title="No checks recorded"
                    description="Run local checks to create persisted health-check history."
                  />
                }
                rows={history.slice(0, 8).map((check) => ({
                  checked: <span>{formatRelativeTime(check.checkedAt)}</span>,
                  latency: <span>{formatLatency(check.responseTimeMs)}</span>,
                  http: <span>{formatHttpStatus(check.httpStatus)}</span>,
                  version: <span>{check.observedVersion ?? "Not reported"}</span>,
                  result: <CheckResultBadge status={check.status} />,
                }))}
              />
            </div>
          </Panel>

          <Panel title="3. Latest Failure">
            {latestFailedCheck ? (
              <div className="space-y-4">
                <CheckResultBadge status={latestFailedCheck.status} />
                <dl className="space-y-3">
                  <DetailRow label="When" value={formatTimestamp(latestFailedCheck.checkedAt)} />
                  <DetailRow label="HTTP status" value={formatHttpStatus(latestFailedCheck.httpStatus)} />
                  <DetailRow label="Latency" value={formatLatency(latestFailedCheck.responseTimeMs)} />
                </dl>
                <div>
                  <p className="mb-2 text-sm font-semibold text-slate-950">Error excerpt</p>
                  <pre className="max-h-44 overflow-auto whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-700">
                    {latestFailedCheck.message ?? "No safe error message recorded."}
                  </pre>
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

        <Panel title="4. Configuration">
          <dl className="grid overflow-hidden rounded-lg border border-slate-200 text-sm md:grid-cols-2 xl:grid-cols-3">
            <div className="border-b border-slate-200 p-4 xl:border-r">
              <dt className="text-xs font-semibold uppercase tracking-[0.04em] text-slate-500">Base URL</dt>
              <dd className="mt-2 font-semibold text-blue-600">
                <TruncatedText value={service.baseUrl} />
              </dd>
            </div>
            <div className="border-b border-slate-200 p-4 xl:border-r">
              <dt className="text-xs font-semibold uppercase tracking-[0.04em] text-slate-500">Health path</dt>
              <dd className="mt-2 font-semibold text-slate-900">{service.healthPath}</dd>
            </div>
            <div className="border-b border-slate-200 p-4">
              <dt className="text-xs font-semibold uppercase tracking-[0.04em] text-slate-500">Expected version</dt>
              <dd className="mt-2 font-semibold text-slate-900">{service.expectedVersion ?? "Not set"}</dd>
            </div>
            <div className="border-b border-slate-200 p-4 xl:border-b-0 xl:border-r">
              <dt className="text-xs font-semibold uppercase tracking-[0.04em] text-slate-500">Environment</dt>
              <dd className="mt-2 font-semibold text-slate-900">{service.environment}</dd>
            </div>
            <div className="border-b border-slate-200 p-4 md:border-b-0 xl:border-r">
              <dt className="text-xs font-semibold uppercase tracking-[0.04em] text-slate-500">Active monitoring</dt>
              <dd className="mt-2 font-semibold text-slate-900">{service.isActive ? "Enabled" : "Disabled"}</dd>
            </div>
            <div className="p-4">
              <dt className="text-xs font-semibold uppercase tracking-[0.04em] text-slate-500">Last healthy</dt>
              <dd className="mt-2 font-semibold text-slate-900">{formatTimestamp(service.lastHealthyAt)}</dd>
            </div>
          </dl>
        </Panel>
      </div>
    </AuthenticatedShell>
  );
}
