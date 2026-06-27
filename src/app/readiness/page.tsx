import { AuthenticatedShell } from "@/components/dashboard/authenticated-shell";
import { EmptyState, PageHeader, Panel, TextLink } from "@/components/dashboard/primitives";

export default function ReadinessPage() {
  return (
    <AuthenticatedShell>
      <div className="space-y-5">
        <PageHeader
          title="Deployment Readiness"
          description="Pre-release checks, deployment evidence, and release history are not connected yet."
        />

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-100">
          <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr_1fr_1fr]">
            <div className="border-b border-slate-200 pb-5 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-5">
              <p className="text-sm font-semibold text-slate-950">Overall readiness</p>
              <div className="mt-4 flex items-center gap-4">
                <span className="flex h-20 w-20 items-center justify-center rounded-full border-8 border-slate-200 bg-slate-50 text-[20px] font-bold text-slate-500">
                  N/A
                </span>
                <div>
                  <p className="text-[20px] font-bold leading-6 text-slate-950">Not connected</p>
                  <p className="mt-2 max-w-sm text-sm font-medium leading-5 text-slate-500">
                    Release readiness scoring is intentionally absent until deployment evidence is integrated.
                  </p>
                </div>
              </div>
            </div>
            {[
              ["Checks passed", "Unavailable", "No release checklist is connected."],
              ["Warnings", "Unavailable", "No release warning source is connected."],
              ["Failures", "Unavailable", "No release failure source is connected."],
            ].map(([label, value, detail]) => (
              <div key={label} className="flex items-center gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                  <span className="h-3 w-3 rounded-full bg-current" />
                </span>
                <div>
                  <p className="text-sm font-medium text-slate-600">{label}</p>
                  <p className="mt-1 text-[22px] font-bold leading-7 text-slate-950">{value}</p>
                  <p className="mt-1 text-xs font-medium text-slate-500">{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="grid items-start gap-4 xl:grid-cols-3">
          <Panel title="1. Environment Checklist">
            <EmptyState
              title="Checklist not connected"
              description="Environment-variable validation exists at app startup, but release checklist records are not persisted in this phase."
            />
          </Panel>
          <Panel title="2. Version & Migration Checks">
            <div className="space-y-3 text-sm leading-5">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="font-semibold text-slate-950">Database migrations</p>
                <p className="mt-1 text-slate-600">
                  Use <span className="font-semibold text-slate-800">npm run db:migrate:status</span> for the real Prisma migration state.
                </p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="font-semibold text-slate-950">Service versions</p>
                <p className="mt-1 text-slate-600">
                  Expected and observed versions are shown on real <TextLink href="/services">service records</TextLink>.
                </p>
              </div>
            </div>
          </Panel>
          <Panel title="3. Deployment Evidence">
            <EmptyState
              title="Deployment integration not connected"
              description="Release history, deployment actors, approvals, logs, and readiness reports are intentionally absent."
            />
          </Panel>
        </div>
      </div>
    </AuthenticatedShell>
  );
}
