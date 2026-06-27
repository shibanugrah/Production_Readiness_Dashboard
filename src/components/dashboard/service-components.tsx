import { HealthCheck, HealthCheckStatus, ServiceStatus } from "@prisma/client";
import Link from "next/link";

import { formatLatency, formatRelativeTime } from "@/components/dashboard/format";
import { StatusBadge, statusTone } from "@/components/dashboard/status";
import { DashboardServiceRow } from "@/server/dashboard/read-models";

export function ServiceStatusCard({ service }: { service: DashboardServiceRow }) {
  return (
    <Link
      href={`/services/${service.id}`}
      className="group rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-100 transition hover:border-blue-200 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
              <path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5z" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <path d="m4 7.5 8 4.5 8-4.5M12 12v9" fill="none" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-[16px] font-semibold leading-6 text-slate-950 group-hover:text-blue-600">{service.name}</h3>
            <p className="truncate text-sm font-medium leading-5 text-slate-500">{service.environment}</p>
          </div>
        </div>
        <StatusBadge status={service.displayStatus} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
        <div>
          <p className="text-sm font-medium leading-5 text-slate-500">Latency</p>
          <p className={`mt-1 text-[16px] font-semibold leading-6 ${statusTone(service.displayStatus)}`}>
            {formatLatency(service.latestCheck?.responseTimeMs)}
          </p>
        </div>
        <div className="border-l border-slate-200 pl-4">
          <p className="text-sm font-medium leading-5 text-slate-500">Last checked</p>
          <p className="mt-1 text-[16px] font-semibold leading-6 text-slate-800">
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

export function SegmentedHealthHistoryStrip({
  checks,
  compact = false,
}: {
  checks: Array<Pick<HealthCheck, "id" | "status" | "checkedAt">>;
  compact?: boolean;
}) {
  if (checks.length === 0) {
    return (
      <div className={`${compact ? "mt-5" : ""} flex h-8 items-center rounded-md bg-slate-50 px-3 text-xs font-medium text-slate-500`}>
        No persisted checks yet
      </div>
    );
  }

  const orderedChecks = [...checks].reverse().slice(-36);

  return (
    <div className={`${compact ? "mt-5" : ""} flex h-7 items-end gap-1 overflow-hidden`} aria-label="Recent check status history">
      {orderedChecks.map((check) => (
        <span
          key={check.id}
          title={`${check.status} at ${check.checkedAt.toISOString()}`}
          className={`h-6 w-[4px] shrink-0 rounded-full ${getCheckColor(check.status)}`}
        />
      ))}
    </div>
  );
}

export const StatusHistoryStrip = SegmentedHealthHistoryStrip;

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
