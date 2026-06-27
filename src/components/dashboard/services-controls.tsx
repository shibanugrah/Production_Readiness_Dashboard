"use client";

import { ServiceStatus } from "@prisma/client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormEvent } from "react";

const controlClass =
  "h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100";

function toSearchParams(current: { toString: () => string }, updates: Record<string, string>) {
  const next = new URLSearchParams(current.toString());

  for (const [key, value] of Object.entries(updates)) {
    if (!value || value === "all") {
      next.delete(key);
    } else {
      next.set(key, value);
    }
  }

  const query = next.toString();
  return query ? `?${query}` : "";
}

export function ServicesFilterBar({
  query,
  environment,
  status,
  environments,
}: {
  query: string;
  environment: string;
  status: string;
  environments: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateFilter(updates: Record<string, string>) {
    router.replace(`${pathname}${toSearchParams(searchParams, updates)}`);
  }

  function onSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    updateFilter({ q: String(formData.get("q") ?? "") });
  }

  return (
    <form
      className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
      onSubmit={onSearchSubmit}
    >
      <label className="relative w-full lg:max-w-[330px]">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true">
          <span className="block h-3 w-3 rounded-full border border-current" />
        </span>
        <input
          name="q"
          defaultValue={query}
          placeholder="Search services..."
          className={`${controlClass} w-full pl-9`}
        />
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <select
          value={environment}
          onChange={(event) => updateFilter({ environment: event.target.value })}
          className={`${controlClass} min-w-[160px]`}
          aria-label="Filter by environment"
        >
          <option value="all">All environments</option>
          {environments.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(event) => updateFilter({ status: event.target.value })}
          className={`${controlClass} min-w-[150px]`}
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          {Object.values(ServiceStatus).map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>
    </form>
  );
}
