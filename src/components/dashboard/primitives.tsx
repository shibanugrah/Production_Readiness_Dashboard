import Link from "next/link";
import { MouseEventHandler, ReactNode } from "react";

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
        {eyebrow ? <div className="mb-2 text-sm font-semibold leading-5 text-blue-600">{eyebrow}</div> : null}
        <h1 className="text-[28px] font-bold leading-[34px] tracking-normal text-slate-950">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-3xl text-[15px] font-medium leading-[22px] text-slate-500">
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
  icon,
}: {
  label: string;
  value: ReactNode;
  detail?: string;
  tone?: "blue" | "green" | "amber" | "rose" | "slate";
  icon?: ReactNode;
}) {
  const tones = {
    blue: "bg-blue-600 text-white shadow-blue-100",
    green: "bg-emerald-500 text-white shadow-emerald-100",
    amber: "bg-amber-500 text-white shadow-amber-100",
    rose: "bg-rose-500 text-white shadow-rose-100",
    slate: "bg-slate-100 text-slate-600 shadow-slate-100",
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-100">
      <div className="flex items-start gap-4">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold shadow-md ${tones[tone]}`}>
          {icon ?? <span className="h-3 w-3 rounded-full bg-current" />}
        </span>
        <div className="min-w-0">
          <p className="text-[14px] font-medium leading-5 text-slate-700">{label}</p>
          <div className="mt-1 text-[27px] font-bold leading-[31px] text-slate-950">{value}</div>
          {detail ? <p className="mt-2 line-clamp-1 text-xs font-medium leading-4 text-slate-500">{detail}</p> : null}
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
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
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
  className = "",
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`min-w-0 rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-100 ${className}`}>
      <div className="flex min-h-12 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <h2 className="text-[15px] font-semibold leading-5 text-slate-950">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export type CompactTableColumn = {
  key: string;
  header: string;
  width?: string;
  className?: string;
};

export function CompactTable({
  columns,
  rows,
  empty,
  minWidth = "900px",
}: {
  columns: CompactTableColumn[];
  rows: Array<Record<string, ReactNode>>;
  empty: ReactNode;
  minWidth?: string;
}) {
  if (rows.length === 0) {
    return <>{empty}</>;
  }

  return (
    <>
      <div className="space-y-3 md:hidden">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="rounded-lg border border-slate-200 bg-white p-3">
            {columns.map((column) => (
              <div
                key={column.key}
                className="grid grid-cols-[112px_1fr] gap-3 border-b border-slate-100 py-2 last:border-b-0"
              >
                <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-500">
                  {column.header}
                </span>
                <div className="min-w-0 text-sm text-slate-700">{row[column.key]}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="hidden w-full max-w-full overflow-x-auto md:block">
        <table
          className="w-full table-fixed border-separate border-spacing-0 text-left"
          style={{ minWidth }}
        >
          <colgroup>
            {columns.map((column) => (
              <col key={column.key} style={column.width ? { width: column.width } : undefined} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`border-b border-slate-200 px-3 py-3 text-[11px] font-semibold uppercase leading-4 tracking-[0.04em] text-slate-500 ${column.className ?? ""}`}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="h-[50px] hover:bg-slate-50">
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`border-b border-slate-100 px-3 py-2.5 align-middle text-sm leading-5 text-slate-700 ${column.className ?? ""}`}
                  >
                    {row[column.key]}
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
                className="border-b border-slate-200 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-500"
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

export function PrimaryButton({
  children,
  type = "button",
  disabled,
  className = "",
  onClick,
}: {
  children: ReactNode;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm shadow-blue-100 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  type = "button",
  disabled,
  className = "",
  onClick,
}: {
  children: ReactNode;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}

export function FormField({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block text-sm font-semibold leading-5 text-slate-800">
      {label}
      <div className="mt-2">{children}</div>
      {hint ? <span className="mt-1 block text-xs font-medium leading-4 text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function TruncatedText({
  value,
  className = "",
}: {
  value: string;
  className?: string;
}) {
  return (
    <span title={value} className={`block min-w-0 truncate ${className}`}>
      {value}
    </span>
  );
}
