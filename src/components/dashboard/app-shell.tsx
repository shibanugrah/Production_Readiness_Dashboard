"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useState } from "react";

const navigation = [
  { href: "/", label: "Overview", icon: "OV" },
  { href: "/services", label: "Services", icon: "SV" },
  { href: "/events", label: "Events", icon: "EV" },
  { href: "/incidents", label: "Incidents", icon: "IN" },
  { href: "/readiness", label: "Readiness", icon: "RD" },
  { href: "/settings", label: "Settings", icon: "ST" },
];

function isActiveRoute(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <Link href="/" onClick={onNavigate} className="flex items-center gap-3 px-5 py-6">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-base font-bold text-white">
          PR
        </span>
        <span>
          <span className="block text-base font-semibold leading-5 text-slate-950">
            Production
          </span>
          <span className="block text-base font-semibold leading-5 text-slate-950">
            Readiness
          </span>
          <span className="mt-1 block text-xs font-medium text-blue-600">
            Dashboard
          </span>
        </span>
      </Link>
      <nav className="mt-3 flex-1 space-y-1 px-3">
        {navigation.map((item) => {
          const active = isActiveRoute(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                active
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <span className="w-6 text-center text-[10px] font-semibold" aria-hidden="true">
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-3 px-3 pb-5">
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-sm font-semibold text-slate-900">
            Portfolio Operations
          </p>
          <p className="text-xs text-slate-500">Local workspace</p>
        </div>
        <p className="px-2 text-xs text-slate-500">
          Operator authentication is not connected yet.
        </p>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white lg:block">
        <SidebarContent />
      </aside>
      {drawerOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-slate-950/30"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="relative z-10 h-full w-72 border-r border-slate-200 bg-white shadow-xl">
            <SidebarContent onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      ) : null}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex min-h-16 items-center gap-3 px-4 md:px-6">
            <button
              type="button"
              className="inline-flex h-10 w-12 items-center justify-center rounded-md border border-slate-200 text-xs font-semibold text-slate-700 lg:hidden"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation"
            >
              Menu
            </button>
            <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2">
              <span className="hidden items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 sm:inline-flex">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Local
              </span>
              <span className="hidden rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 md:inline-flex">
                Last 24 hours
              </span>
              <div className="hidden min-w-0 max-w-md flex-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-400 md:block">
                Search services, events, incidents...
              </div>
              <span className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                Status from checks
              </span>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1480px] overflow-x-hidden px-4 py-5 md:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
