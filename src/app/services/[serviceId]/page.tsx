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
import { ServiceConfigurationControls } from "@/components/dashboard/service-configuration-controls";
import { CheckResultBadge, StatusBadge, statusTone } from "@/components/dashboard/status";
import { canManageServices, canRunChecks } from "@/server/auth/permissions";
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

function MetricValue({
  value,
  className = "",
}: {
  value: string;
  className?: string;
}) {
  return (
    <span
      title={value}
      className={`block min-w-0 truncate text-[24px] leading-[30px] ${className}`}
    >
      {value}
    </span>
  );
}

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

function formatAuditSummary(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") {
    return "No field summary recorded.";
  }

  const record = metadata as {
    summary?: unknown;
    changes?: unknown;
  };
  const summary = typeof record.summary === "string" ? record.summary : null;
  const changes = Array.isArray(record.changes)
    ? record.changes
        .map((item) => {
          if (!item || typeof item !== "object") {
            return null;
          }

          const change = item as {
            field?: unknown;
            from?: unknown;
            to?: unknown;
          };
          const field = typeof change.field === "string" ? change.field : null;

          if (!field) {
            return null;
          }

          const from = change.from === null || change.from === undefined ? "not set" : String(change.from);
          const to = change.to === null || change.to === undefined ? "not set" : String(change.to);
          return `${field}: ${from} -> ${to}`;
        })
        .filter((item): item is string => item !== null)
    : [];

  if (changes.length > 0) {
    const visibleChanges = changes.slice(0, 3).join("; ");
    const remaining = changes.length > 3 ? `; +${changes.length - 3} more` : "";
    return `${visibleChanges}${remaining}`;
  }

  return summary ?? "No field summary recorded.";
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
                {service.isActive ? "Monitoring enabled" : "Monitoring disabled"}
              </span>
            </div>
          </div>
          <RunChecksControl
            enabled={canRunChecks(model)}
            returnPath={`/services/${service.id}`}
            result={checksResult}
            variant="secondary"
          />
        </header>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            label="Current status"
            value={
              <MetricValue
                value={service.displayStatus}
                className={statusTone(service.displayStatus)}
              />
            }
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
            value={<MetricValue value={latestVersion} />}
            detail={latestCheck?.observedVersion ? "Observed version" : "Expected version"}
            tone="blue"
          />
          <MetricCard
            label="Latest result"
            value={<MetricValue value={latestCheck ? latestCheck.status : "No result"} />}
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
                    description="Run manual checks to create persisted health-check history."
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
          <ServiceConfigurationControls
            service={{
              id: service.id,
              name: service.name,
              slug: service.slug,
              baseUrl: service.baseUrl,
              healthPath: service.healthPath,
              environment: service.environment,
              expectedVersion: service.expectedVersion,
              isActive: service.isActive,
            }}
            environments={model.environments}
            canManage={canManageServices(model)}
          />
        </Panel>

        <Panel title="5. Configuration activity">
          <CompactTable
            minWidth="760px"
            columns={[
              { key: "time", header: "Time", width: "18%" },
              { key: "actor", header: "Actor", width: "22%" },
              { key: "action", header: "Action", width: "16%" },
              { key: "summary", header: "Summary", width: "44%" },
            ]}
            empty={
              <EmptyState
                title="No configuration activity"
                description="Service management changes will appear here after Owner or Admin updates."
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
              summary: <TruncatedText value={formatAuditSummary(entry.metadataJson)} className="text-slate-700" />,
            }))}
          />
        </Panel>
      </div>
    </AuthenticatedShell>
  );
}
