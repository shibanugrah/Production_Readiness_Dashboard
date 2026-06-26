import Link from "next/link";
import { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div>
        {eyebrow ? <div className="mb-2 text-sm font-medium text-blue-600">{eyebrow}</div> : null}
        <h1 className="text-2xl font-semibold tracking-normal text-slate-950">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  tone = "blue",
}: {
  label: string;
  value: ReactNode;
  detail?: string;
  tone?: "blue" | "green" | "amber" | "rose" | "slate";
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    rose: "bg-rose-50 text-rose-600",
    slate: "bg-slate-50 text-slate-600",
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 h-9 w-9 rounded-full ${tones[tone]} flex items-center justify-center text-sm font-semibold`}>
          <span className="h-2.5 w-2.5 rounded-full bg-current" />
        </span>
        <div>
          <p className="text-sm font-medium text-slate-700">{label}</p>
          <div className="mt-1 text-2xl font-semibold text-slate-950">{value}</div>
          {detail ? <p className="mt-1 text-xs text-slate-500">{detail}</p> : null}
        </div>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
        {description}
      </p>
    </div>
  );
}

export function ErrorState({
  title = "Unable to load dashboard data",
  description = "The database request failed. Try again after confirming the local stack is running.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-rose-900">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-sm">{description}</p>
    </div>
  );
}

export function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-20 animate-pulse rounded-lg bg-slate-200" />
      <div className="grid gap-4 md:grid-cols-4">
        <div className="h-28 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-28 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-28 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-28 animate-pulse rounded-lg bg-slate-200" />
      </div>
      <div className="h-72 animate-pulse rounded-lg bg-slate-200" />
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function DataTable({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: ReactNode[][];
  empty: ReactNode;
}) {
  if (rows.length === 0) {
    return <>{empty}</>;
  }

  return (
    <>
      <div className="space-y-3 md:hidden">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="rounded-lg border border-slate-200 p-3">
            {row.map((cell, cellIndex) => (
              <div
                key={cellIndex}
                className="grid grid-cols-[110px_1fr] gap-3 border-b border-slate-100 py-2 last:border-b-0"
              >
                <span className="text-xs font-semibold uppercase text-slate-500">
                  {headers[cellIndex]}
                </span>
                <div className="min-w-0 text-sm text-slate-700">{cell}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="hidden w-full max-w-full overflow-x-auto md:block">
        <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left text-sm">
        <thead>
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                className="border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase text-slate-500"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-slate-50">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="border-b border-slate-100 px-3 py-3 align-middle text-slate-700">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        </table>
      </div>
    </>
  );
}

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link className="font-medium text-blue-600 hover:text-blue-700" href={href}>
      {children}
    </Link>
  );
}
