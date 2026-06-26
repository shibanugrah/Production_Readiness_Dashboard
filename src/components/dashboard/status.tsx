import { HealthCheckStatus, ServiceStatus } from "@prisma/client";

const serviceStatusStyles = {
  [ServiceStatus.HEALTHY]: "border-emerald-200 bg-emerald-50 text-emerald-700",
  [ServiceStatus.DEGRADED]: "border-amber-200 bg-amber-50 text-amber-700",
  [ServiceStatus.DOWN]: "border-rose-200 bg-rose-50 text-rose-700",
  [ServiceStatus.UNKNOWN]: "border-slate-200 bg-slate-50 text-slate-600",
};

const checkStatusStyles = {
  [HealthCheckStatus.SUCCESS]: "border-emerald-200 bg-emerald-50 text-emerald-700",
  [HealthCheckStatus.DEGRADED]: "border-amber-200 bg-amber-50 text-amber-700",
  [HealthCheckStatus.FAILURE]: "border-rose-200 bg-rose-50 text-rose-700",
};

const checkLabels = {
  [HealthCheckStatus.SUCCESS]: "Success",
  [HealthCheckStatus.DEGRADED]: "Degraded",
  [HealthCheckStatus.FAILURE]: "Failure",
};

function serviceDotStyle(status: ServiceStatus) {
  if (status === ServiceStatus.HEALTHY) {
    return "bg-emerald-500";
  }

  if (status === ServiceStatus.DEGRADED) {
    return "bg-amber-500";
  }

  if (status === ServiceStatus.DOWN) {
    return "bg-rose-500";
  }

  return "bg-slate-400";
}

function checkDotStyle(status: HealthCheckStatus) {
  if (status === HealthCheckStatus.SUCCESS) {
    return "bg-emerald-500";
  }

  if (status === HealthCheckStatus.DEGRADED) {
    return "bg-amber-500";
  }

  return "bg-rose-500";
}

function toTitle(value: string) {
  return value.slice(0, 1) + value.slice(1).toLowerCase();
}

export function StatusBadge({ status }: { status: ServiceStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${serviceStatusStyles[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${serviceDotStyle(status)}`} />
      {toTitle(status)}
    </span>
  );
}

export function CheckResultBadge({ status }: { status: HealthCheckStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${checkStatusStyles[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${checkDotStyle(status)}`} />
      {checkLabels[status]}
    </span>
  );
}

export function statusTone(status: ServiceStatus) {
  if (status === ServiceStatus.HEALTHY) {
    return "text-emerald-600";
  }

  if (status === ServiceStatus.DEGRADED) {
    return "text-amber-600";
  }

  if (status === ServiceStatus.DOWN) {
    return "text-rose-600";
  }

  return "text-slate-500";
}
