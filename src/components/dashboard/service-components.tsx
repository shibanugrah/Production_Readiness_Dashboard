import { HealthCheck, HealthCheckStatus, ServiceStatus } from "@prisma/client";
import Link from "next/link";

import { formatLatency, formatRelativeTime } from "@/components/dashboard/format";
import { StatusBadge, statusTone } from "@/components/dashboard/status";
import { DashboardServiceRow } from "@/server/dashboard/read-models";

export function ServiceStatusCard({ service }: { service: DashboardServiceRow }) {
  return (
    <Link
      href={`/services/${service.id}`}
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">{service.name}</h3>
          <p className="mt-1 text-xs text-slate-500">{service.environment}</p>
        </div>
        <StatusBadge status={service.displayStatus} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
        <div>
          <p className="text-xs font-medium text-slate-500">Latest latency</p>
          <p className={`mt-1 text-sm font-semibold ${statusTone(service.displayStatus)}`}>
            {formatLatency(service.latestCheck?.responseTimeMs)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">Last checked</p>
          <p className="mt-1 text-sm font-semibold text-slate-800">
            {formatRelativeTime(service.lastCheckedAt)}
          </p>
        </div>
      </div>
      <StatusHistoryStrip checks={service.healthChecks} compact />
    </Link>
  );
}

function getCheckColor(status: HealthCheckStatus) {
  if (status === HealthCheckStatus.SUCCESS) {
    return "bg-emerald-500";
  }

  if (status === HealthCheckStatus.DEGRADED) {
    return "bg-amber-500";
  }

  return "bg-rose-500";
}

export function StatusHistoryStrip({
  checks,
  compact = false,
}: {
  checks: Array<Pick<HealthCheck, "id" | "status" | "checkedAt">>;
  compact?: boolean;
}) {
  if (checks.length === 0) {
    return (
      <div className={`${compact ? "mt-4" : ""} flex h-8 items-center rounded-md bg-slate-50 px-3 text-xs text-slate-500`}>
        No persisted checks yet
      </div>
    );
  }

  const orderedChecks = [...checks].reverse().slice(-24);

  return (
    <div className={`${compact ? "mt-4" : ""} flex items-end gap-1`} aria-label="Recent check status history">
      {orderedChecks.map((check) => (
        <span
          key={check.id}
          title={`${check.status} at ${check.checkedAt.toISOString()}`}
          className={`h-6 flex-1 min-w-1 rounded-sm ${getCheckColor(check.status)}`}
        />
      ))}
    </div>
  );
}

export function statusDescription(status: ServiceStatus) {
  if (status === ServiceStatus.HEALTHY) {
    return "Latest persisted check was successful.";
  }

  if (status === ServiceStatus.DEGRADED) {
    return "Latest valid check showed slow latency or a version mismatch.";
  }

  if (status === ServiceStatus.DOWN) {
    return "Latest attempted check failed.";
  }

  return "No successful persisted check evidence is available yet.";
}
