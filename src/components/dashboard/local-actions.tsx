"use client";

import { useFormStatus } from "react-dom";

import {
  addLocalDemoServiceAction,
  runLocalChecksAction,
} from "@/server/dashboard/actions";

const serviceEnvironments = ["LOCAL", "PREVIEW", "STAGING", "PRODUCTION"];

function SubmitButton({
  children,
  pendingText,
  className,
  disabled,
}: {
  children: string;
  pendingText: string;
  className: string;
  disabled?: boolean;
}) {
  const status = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || status.pending}
      className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {status.pending ? pendingText : children}
    </button>
  );
}

export function RunChecksControl({
  enabled,
  returnPath,
  result,
}: {
  enabled: boolean;
  returnPath: string;
  result?: string;
}) {
  if (!enabled) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
        Operator authentication is required to run checks.
      </div>
    );
  }

  const message =
    result === "success"
      ? "Checks completed."
      : result === "error"
        ? "Checks failed safely."
        : result === "denied"
          ? "Your role cannot run checks."
        : result === "disabled"
          ? "Local checks are disabled."
          : null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={runLocalChecksAction}>
        <input type="hidden" name="returnPath" value={returnPath} />
        <SubmitButton
          pendingText="Running..."
          className="inline-flex rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          Run local checks
        </SubmitButton>
      </form>
      {message ? (
        <span className="text-sm text-slate-600" role="status">
          {message}
        </span>
      ) : null}
    </div>
  );
}

export function AddServicePanel({
  enabled,
  result,
}: {
  enabled: boolean;
  result?: string;
}) {
  const message =
    result === "created"
      ? "Service created."
      : result === "error"
        ? "Service could not be created."
        : result === "denied"
          ? "Your role cannot create services."
        : result === "disabled"
          ? "Local service creation is disabled."
          : null;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-950">Add service</h2>
          <p className="mt-1 text-sm text-slate-600">
            {enabled
              ? "Local demo mode can add a service through server validation."
              : "Service creation requires operator authentication outside local demo mode."}
          </p>
        </div>
      </div>
      {enabled ? (
        <form action={addLocalDemoServiceAction} className="mt-4 grid gap-3 md:grid-cols-2">
          <input type="hidden" name="returnPath" value="/services" />
          <label className="text-sm font-medium text-slate-700">
            Name
            <input
              required
              name="name"
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              placeholder="Billing API"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Slug
            <input
              required
              name="slug"
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              placeholder="billing-api"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Base URL
            <input
              required
              name="baseUrl"
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              placeholder="http://app:3000"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Health path
            <input
              required
              name="healthPath"
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              placeholder="/api/demo-service/health"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Environment
            <select
              name="environment"
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              defaultValue="LOCAL"
            >
              {serviceEnvironments.map((environment) => (
                <option key={environment} value={environment}>
                  {environment}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Expected version
            <input
              name="expectedVersion"
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              placeholder="local-demo"
            />
          </label>
          <div className="md:col-span-2">
            <SubmitButton
              pendingText="Creating..."
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Create local service
            </SubmitButton>
          </div>
        </form>
      ) : (
        <button
          type="button"
          disabled
          className="mt-4 rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500"
        >
          Add service unavailable
        </button>
      )}
      {message ? (
        <p className="mt-3 text-sm text-slate-600" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
