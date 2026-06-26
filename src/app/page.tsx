export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-6 py-16">
      <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">
        Production Readiness Dashboard
      </p>
      <h1 className="text-3xl font-semibold text-slate-950">
        Application foundation is running.
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-slate-700">
        Phase 0 is intentionally minimal: Next.js, PostgreSQL connectivity,
        environment validation, tests, CI, and a machine-readable self-health
        endpoint.
      </p>
      <a
        className="mt-8 inline-flex w-fit items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
        href="/api/health"
      >
        Open health endpoint
      </a>
    </main>
  );
}
