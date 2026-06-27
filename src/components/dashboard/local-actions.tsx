"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

import { FormField, PrimaryButton, SecondaryButton } from "@/components/dashboard/primitives";
import { runLocalChecksAction } from "@/server/dashboard/actions";
import { createServiceAction } from "@/server/services/actions";

const serviceEnvironments = ["LOCAL", "PREVIEW", "STAGING", "PRODUCTION"];
const initialServiceActionState = {
  ok: false,
  message: null,
  fieldErrors: {},
};

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
  variant = "default",
}: {
  enabled: boolean;
  returnPath: string;
  result?: string;
  variant?: "default" | "topbar" | "secondary";
}) {
  if (!enabled) {
    return null;
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
          className={
            variant === "secondary"
              ? "inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-blue-600 shadow-sm hover:bg-blue-50"
              : "inline-flex h-10 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm shadow-blue-100 hover:bg-blue-700"
          }
        >
          {variant === "topbar" ? "Run Checks" : "Run local checks"}
        </SubmitButton>
      </form>
      {message && variant !== "topbar" ? (
        <span className="text-sm text-slate-600" role="status">
          {message}
        </span>
      ) : null}
    </div>
  );
}

const inputClass =
  "h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100";

function FieldErrors({ errors }: { errors?: string[] }) {
  if (!errors?.length) {
    return null;
  }

  return (
    <p className="mt-1 text-xs font-semibold leading-4 text-rose-600">
      {errors[0]}
    </p>
  );
}

export function AddServiceDrawer({
  enabled,
  result,
}: {
  enabled: boolean;
  result?: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const firstInputRef = useRef<HTMLInputElement>(null);
  const [state, formAction] = useActionState(
    createServiceAction,
    initialServiceActionState,
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimeout = window.setTimeout(() => firstInputRef.current?.focus(), 0);

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);

    return () => {
      window.clearTimeout(focusTimeout);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!state.ok) {
      return;
    }

    router.refresh();
  }, [router, state.ok]);

  const message =
    state.message ??
    (result === "created"
      ? "Service created."
      : result === "error"
        ? "Service could not be created."
        : result === "denied"
          ? "Your role cannot create services."
          : result === "disabled"
            ? "Local service creation is disabled."
            : null);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        {message ? (
          <span
            className={`text-sm font-medium ${state.message && !state.ok ? "text-rose-600" : "text-slate-600"}`}
            role="status"
          >
            {message}
          </span>
        ) : null}
        {!enabled ? (
          <span className="text-sm font-medium text-slate-500">
            Viewer access is read-only.
          </span>
        ) : null}
        <PrimaryButton
          disabled={!enabled}
          onClick={() => enabled && setOpen(true)}
          className="px-4"
        >
          <span aria-hidden="true" className="text-lg leading-none">+</span>
          Add Service
        </PrimaryButton>
      </div>
      {open ? (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="add-service-title">
          <button
            type="button"
            aria-label="Close add service drawer"
            className="absolute inset-0 bg-slate-950/25"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute right-0 top-0 flex h-full w-full flex-col border-l border-slate-200 bg-white shadow-xl sm:w-[390px]">
            <div className="flex h-16 items-start justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 id="add-service-title" className="text-[20px] font-bold leading-6 text-slate-950">
                  Add Service
                </h2>
                <p className="mt-1 text-sm font-medium leading-5 text-slate-500">
                  Register a new service for monitoring.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close drawer"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-xl leading-none text-slate-500 hover:bg-slate-50 hover:text-slate-950"
              >
                x
              </button>
            </div>
            <form action={formAction} className="flex min-h-0 flex-1 flex-col">
              <input type="hidden" name="returnPath" value="/services" />
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
                <FormField label="Service name">
                  <input
                    ref={firstInputRef}
                    required
                    name="name"
                    className={inputClass}
                    placeholder="Billing API"
                  />
                  <FieldErrors errors={state.fieldErrors.name} />
                </FormField>
                <FormField label="Slug">
                  <input
                    required
                    name="slug"
                    className={inputClass}
                    placeholder="billing-api"
                  />
                  <FieldErrors errors={state.fieldErrors.slug} />
                </FormField>
                <FormField label="Base URL">
                  <input
                    required
                    name="baseUrl"
                    className={inputClass}
                    placeholder="http://app:3000"
                  />
                  <FieldErrors errors={state.fieldErrors.baseUrl} />
                </FormField>
                <FormField label="Health path">
                  <input
                    required
                    name="healthPath"
                    className={inputClass}
                    placeholder="/api/demo-service/health"
                  />
                  <FieldErrors errors={state.fieldErrors.healthPath} />
                </FormField>
                <FormField label="Environment">
                  <select
                    name="environment"
                    className={inputClass}
                    defaultValue="LOCAL"
                  >
                    {serviceEnvironments.map((environment) => (
                      <option key={environment} value={environment}>
                        {environment}
                      </option>
                    ))}
                  </select>
                  <FieldErrors errors={state.fieldErrors.environment} />
                </FormField>
                <FormField label="Expected version (optional)">
                  <input
                    name="expectedVersion"
                    className={inputClass}
                    placeholder="local-demo"
                  />
                  <FieldErrors errors={state.fieldErrors.expectedVersion} />
                </FormField>
              </div>
              <div className="sticky bottom-0 grid grid-cols-2 gap-3 border-t border-slate-200 bg-white p-5">
                <SecondaryButton type="button" onClick={() => setOpen(false)}>
                  Cancel
                </SecondaryButton>
                <SubmitButton
                  pendingText="Saving..."
                  className="inline-flex h-10 items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm shadow-blue-100 hover:bg-blue-700"
                >
                  Save Service
                </SubmitButton>
              </div>
            </form>
          </aside>
        </div>
      ) : null}
    </>
  );
}

export function AddServicePanel(props: {
  enabled: boolean;
  result?: string;
}) {
  return <AddServiceDrawer {...props} />;
}
