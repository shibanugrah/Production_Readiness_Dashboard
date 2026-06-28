import { publicDemoSignInAction, signInAction } from "@/server/auth/actions";
import { getPublicDemoAvailability } from "@/server/public-demo";

export default async function SignInPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const error = params.error === "invalid";
  const unavailable = params.error === "unavailable";
  const publicDemoUnavailable = params.demo === "unavailable";
  const signedOut = params.signedOut === "1";
  const returnPath =
    typeof params.returnPath === "string" && params.returnPath.startsWith("/")
      ? params.returnPath
      : "/";
  const publicDemo = await getPublicDemoAvailability();

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-600 text-base font-bold text-white">
            PR
          </span>
          <div>
            <h1 className="text-xl font-semibold text-slate-950">
              Sign in
            </h1>
            <p className="text-sm text-slate-600">
              Production Readiness Dashboard
            </p>
          </div>
        </div>

        <p className="mt-5 text-sm leading-6 text-slate-600">
          Operators sign in with configured credentials. Workspace access and
          role permissions are resolved from database membership after sign-in.
        </p>

        {error ? (
          <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            Invalid email or password.
          </div>
        ) : null}
        {unavailable ? (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Sign-in is temporarily unavailable because the database cannot be reached.
          </div>
        ) : null}
        {signedOut ? (
          <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Signed out successfully.
          </div>
        ) : null}
        {publicDemoUnavailable ? (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            The read-only public demo is waiting for a real recent Healthy check.
          </div>
        ) : null}

        {publicDemo.kind !== "disabled" ? (
          <section className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-950">
                  Public demo
                </h2>
                <p className="mt-1 text-sm leading-5 text-slate-600">
                  Scheduled checks are intentionally not configured for this free public demo.
                  Owner/Admin users can run manual health checks.
                </p>
              </div>
              <p className="text-xs leading-5 text-slate-500">
                Automated alerting, paging, production notification delivery, and external integrations are future work and are not presented as active.
              </p>
              {publicDemo.kind === "available" ? (
                <form action={publicDemoSignInAction}>
                  <button className="w-full rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                    Explore read-only demo
                  </button>
                </form>
              ) : (
                <div className="rounded-md border border-amber-200 bg-white px-3 py-2 text-sm font-medium text-amber-800">
                  <p>{publicDemo.message}</p>
                  <p className="mt-1 text-xs leading-5 text-amber-700">
                    {publicDemo.operatorHint}
                  </p>
                </div>
              )}
            </div>
          </section>
        ) : null}

        <form action={signInAction} className="mt-6 space-y-4">
          <input type="hidden" name="returnPath" value={returnPath} />
          <label className="block text-sm font-medium text-slate-700">
            Email
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              placeholder="Configured operator email"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Password
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              placeholder="Stored in local .env"
            />
          </label>
          <button className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            Sign in
          </button>
        </form>
      </section>
    </main>
  );
}
