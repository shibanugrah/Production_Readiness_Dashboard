import { signInAction } from "@/server/auth/actions";

export default async function SignInPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const error = params.error === "invalid";
  const unavailable = params.error === "unavailable";
  const signedOut = params.signedOut === "1";
  const returnPath =
    typeof params.returnPath === "string" && params.returnPath.startsWith("/")
      ? params.returnPath
      : "/";

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
          Use a seeded demo account. Workspace access and role permissions are
          resolved from the database after sign-in.
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
              placeholder="owner@example.local"
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
