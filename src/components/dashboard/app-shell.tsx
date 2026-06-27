"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useState } from "react";

import { RunChecksControl } from "@/components/dashboard/local-actions";
import { signOutAction } from "@/server/auth/actions";

const navigation = [
  { href: "/", label: "Overview", icon: "home" },
  { href: "/services", label: "Services", icon: "cube" },
  { href: "/events", label: "Events", icon: "bell" },
  { href: "/incidents", label: "Incidents", icon: "warning" },
  { href: "/readiness", label: "Readiness", icon: "shield" },
  { href: "/settings", label: "Settings", icon: "gear" },
];

function isActiveRoute(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export type AppShellUser = {
  name: string;
  email: string;
  role: string;
  workspaceName: string;
};

function ShellIcon({
  name,
  active = false,
}: {
  name: string;
  active?: boolean;
}) {
  const stroke = active ? "#2563EB" : "currentColor";
  const fill = active && name === "home" ? "#2563EB" : "none";

  if (name === "home") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]">
        <path
          d="M4 10.5 12 4l8 6.5V20H4z"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (name === "cube") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]">
        <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z" fill="none" stroke={stroke} strokeWidth="1.8" />
        <path d="m4 7.5 8 4.5 8-4.5M12 12v9" fill="none" stroke={stroke} strokeWidth="1.8" />
      </svg>
    );
  }

  if (name === "bell") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]">
        <path d="M18 9a6 6 0 0 0-12 0c0 7-3 6-3 8h18c0-2-3-1-3-8Z" fill="none" stroke={stroke} strokeWidth="1.8" />
        <path d="M10 20a2 2 0 0 0 4 0" fill="none" stroke={stroke} strokeWidth="1.8" />
      </svg>
    );
  }

  if (name === "warning") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]">
        <path d="M12 4 3 20h18z" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M12 9v5M12 17h.01" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  if (name === "shield") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]">
        <path d="M12 3 19 6v5c0 4.4-2.8 8.4-7 10-4.2-1.6-7-5.6-7-10V6z" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" />
        <path d="m9 12 2 2 4-5" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]">
      <path d="M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z" fill="none" stroke={stroke} strokeWidth="1.8" />
      <path d="m19 12 2-1-2-4-2 .6a7.7 7.7 0 0 0-1.3-.8L15.4 4h-6.8l-.3 2.8c-.5.2-.9.5-1.3.8L5 7l-2 4 2 1v1.9l-2 1 2 4 2-.6c.4.3.8.6 1.3.8l.3 2.9h6.8l.3-2.9c.5-.2.9-.5 1.3-.8l2 .6 2-4-2-1V12Z" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function ProductMark() {
  return (
    <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-blue-600 text-white shadow-sm shadow-blue-200">
      <svg viewBox="0 0 32 32" aria-hidden="true" className="h-8 w-8">
        <path d="M16 3 27 8v8.2C27 22.3 22.4 27.5 16 29 9.6 27.5 5 22.3 5 16.2V8z" fill="#EEF2FF" />
        <path d="M16 8 22 10.8v4.7c0 3.2-2.4 5.9-6 6.9-3.6-1-6-3.7-6-6.9v-4.7z" fill="#2563EB" />
      </svg>
    </span>
  );
}

function SidebarContent({
  onNavigate,
  user,
}: {
  onNavigate?: () => void;
  user: AppShellUser;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col bg-white">
      <Link href="/" onClick={onNavigate} className="flex items-start gap-3 px-5 pb-6 pt-6">
        <ProductMark />
        <span>
          <span className="block text-[18px] font-bold leading-[20px] text-slate-950">
            Production
          </span>
          <span className="block text-[18px] font-bold leading-[20px] text-slate-950">
            Readiness
          </span>
          <span className="mt-1 block text-[13px] font-medium leading-4 text-blue-600">
            Dashboard
          </span>
        </span>
      </Link>
      <nav className="flex-1 space-y-2 px-3 pt-5">
        {navigation.map((item) => {
          const active = isActiveRoute(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex h-11 items-center gap-3 rounded-lg px-3 text-[14px] font-medium transition ${
                active
                  ? "bg-blue-50 text-blue-600"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <span className="flex h-6 w-6 items-center justify-center" aria-hidden="true">
                <ShellIcon name={item.icon} active={active} />
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-3 px-3 pb-5">
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-600 text-xs font-semibold text-white">
              {user.workspaceName.slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-5 text-slate-900">
                {user.workspaceName}
              </p>
              <p className="truncate text-xs leading-4 text-slate-500">{user.name}</p>
            </div>
          </div>
          <p className="mt-2 text-xs font-medium uppercase tracking-[0.04em] text-blue-600">
            {user.role.toLowerCase()}
          </p>
        </div>
        <form action={signOutAction}>
          <button className="flex h-10 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-950">
            <span aria-hidden="true" className="text-lg leading-none">-</span>
            Sign out
          </button>
        </form>
        <div className="flex h-10 items-center gap-3 px-3 text-sm font-medium text-slate-600">
          <span aria-hidden="true" className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-400 text-xs">?</span>
          Help & Docs
        </div>
      </div>
    </div>
  );
}

function TopBar({
  user,
  canRunLocalChecks,
}: {
  user: AppShellUser;
  canRunLocalChecks: boolean;
}) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-5">
        <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-3">
          <button className="hidden h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 shadow-sm sm:inline-flex">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Local
            <span className="ml-2 text-slate-500">v</span>
          </button>
          <button className="hidden h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 shadow-sm md:inline-flex">
            <span aria-hidden="true" className="h-3 w-3 rounded-sm border border-slate-500" />
            Last 24 hours
            <span className="ml-2 text-slate-500">v</span>
          </button>
          <label className="relative hidden min-w-[260px] max-w-[420px] flex-1 lg:block">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true">
              <span className="block h-3 w-3 rounded-full border border-current" />
            </span>
            <input
              type="search"
              placeholder="Search services, events, incidents..."
              className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm font-medium text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <div className="relative hidden h-10 w-10 items-center justify-center rounded-md text-slate-700 md:flex">
            <span aria-hidden="true" className="h-4 w-3 rounded-t-full border border-current border-b-0" />
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
              3
            </span>
          </div>
          <span className="hidden h-10 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm sm:inline-flex">
            {user.role === "VIEWER" ? "Read-only" : "Operator"}
          </span>
          {canRunLocalChecks ? (
            <RunChecksControl
              enabled
              returnPath={pathname}
              variant="topbar"
            />
          ) : null}
        </div>
      </div>
    </header>
  );
}

function MobileTopBar({
  openDrawer,
}: {
  openDrawer: () => void;
}) {
  return (
    <div className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 lg:hidden">
      <button
        type="button"
        className="inline-flex h-10 w-12 items-center justify-center rounded-md border border-slate-200 text-xs font-semibold text-slate-700"
        onClick={openDrawer}
        aria-label="Open navigation"
      >
        Menu
      </button>
      <div className="flex items-center gap-2">
        <ProductMark />
        <span className="text-sm font-bold leading-4 text-slate-950">
          Production Readiness
        </span>
      </div>
    </div>
  );
}

export function AppShell({
  children,
  user,
  canRunLocalChecks,
}: {
  children: ReactNode;
  user: AppShellUser;
  canRunLocalChecks: boolean;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <aside className="fixed inset-y-0 left-0 hidden w-[200px] border-r border-slate-200 bg-white lg:block">
        <SidebarContent user={user} />
      </aside>
      {drawerOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-slate-950/30"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="relative z-10 h-full w-[280px] border-r border-slate-200 bg-white shadow-xl">
            <SidebarContent user={user} onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      ) : null}
      <div className="lg:pl-[200px]">
        <div className="lg:hidden">
          <MobileTopBar openDrawer={() => setDrawerOpen(true)} />
        </div>
        <div className="hidden lg:block">
          <TopBar user={user} canRunLocalChecks={canRunLocalChecks} />
        </div>
        <main className="mx-auto w-full max-w-[1328px] overflow-x-hidden px-4 py-5 md:px-7">
          {children}
        </main>
      </div>
    </div>
  );
}
