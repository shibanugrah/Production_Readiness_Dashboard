"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

import { PrimaryButton, SecondaryButton } from "@/components/dashboard/primitives";
import {
  deactivateServiceAction,
  reactivateServiceAction,
  updateServiceConfigurationAction,
} from "@/server/services/actions";

const inputClass =
  "h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500";
const initialServiceActionState = {
  ok: false,
  message: null,
  fieldErrors: {},
};

type EditableService = {
  id: string;
  name: string;
  slug: string;
  baseUrl: string;
  healthPath: string;
  environment: string;
  expectedVersion: string | null;
  isActive: boolean;
};

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

function SaveButton({ disabled }: { disabled: boolean }) {
  const status = useFormStatus();

  return (
    <PrimaryButton type="submit" disabled={disabled || status.pending}>
      {status.pending ? "Saving..." : "Save configuration"}
    </PrimaryButton>
  );
}

function MonitoringButton({
  active,
  disabled,
}: {
  active: boolean;
  disabled: boolean;
}) {
  const status = useFormStatus();

  return (
    <SecondaryButton type="submit" disabled={disabled || status.pending}>
      <span
        aria-hidden="true"
        className={`h-2.5 w-2.5 rounded-full ${active ? "bg-emerald-500" : "bg-slate-400"}`}
      />
      {status.pending
        ? "Saving..."
        : active
          ? "Deactivate monitoring"
          : "Reactivate monitoring"}
    </SecondaryButton>
  );
}

export function ServiceConfigurationControls({
  service,
  environments,
  canManage,
}: {
  service: EditableService;
  environments: string[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [updateState, updateAction] = useActionState(
    updateServiceConfigurationAction,
    initialServiceActionState,
  );
  const [deactivateState, deactivateAction] = useActionState(
    deactivateServiceAction,
    initialServiceActionState,
  );
  const [reactivateState, reactivateAction] = useActionState(
    reactivateServiceAction,
    initialServiceActionState,
  );
  const monitoringState = service.isActive ? deactivateState : reactivateState;

  useEffect(() => {
    if (updateState.ok || deactivateState.ok || reactivateState.ok) {
      router.refresh();
    }
  }, [deactivateState.ok, reactivateState.ok, router, updateState.ok]);

  return (
    <div className="space-y-5">
      {!canManage ? (
        <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600">
          Viewer access is read-only. Owner or Admin access is required to change service configuration.
        </p>
      ) : null}

      {updateState.message ? (
        <p
          className={`text-sm font-semibold ${updateState.ok ? "text-emerald-600" : "text-rose-600"}`}
          role="status"
        >
          {updateState.message}
        </p>
      ) : null}

      <form action={updateAction} className="space-y-4">
        <input type="hidden" name="serviceId" value={service.id} />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="block text-sm font-semibold leading-5 text-slate-800">
            Name
            <input
              name="name"
              required
              disabled={!canManage}
              defaultValue={service.name}
              className={`${inputClass} mt-2`}
            />
            <FieldErrors errors={updateState.fieldErrors.name} />
          </label>
          <label className="block text-sm font-semibold leading-5 text-slate-800">
            Slug
            <input
              name="slug"
              required
              disabled={!canManage}
              defaultValue={service.slug}
              className={`${inputClass} mt-2`}
            />
            <FieldErrors errors={updateState.fieldErrors.slug} />
          </label>
          <label className="block text-sm font-semibold leading-5 text-slate-800">
            Environment
            <select
              name="environment"
              disabled={!canManage}
              defaultValue={service.environment}
              className={`${inputClass} mt-2`}
            >
              {environments.map((environment) => (
                <option key={environment} value={environment}>
                  {environment}
                </option>
              ))}
            </select>
            <FieldErrors errors={updateState.fieldErrors.environment} />
          </label>
          <label className="block text-sm font-semibold leading-5 text-slate-800 md:col-span-2">
            Base URL
            <input
              name="baseUrl"
              required
              disabled={!canManage}
              defaultValue={service.baseUrl}
              className={`${inputClass} mt-2`}
            />
            <FieldErrors errors={updateState.fieldErrors.baseUrl} />
          </label>
          <label className="block text-sm font-semibold leading-5 text-slate-800">
            Health path
            <input
              name="healthPath"
              required
              disabled={!canManage}
              defaultValue={service.healthPath}
              className={`${inputClass} mt-2`}
            />
            <FieldErrors errors={updateState.fieldErrors.healthPath} />
          </label>
          <label className="block text-sm font-semibold leading-5 text-slate-800">
            Expected version
            <input
              name="expectedVersion"
              disabled={!canManage}
              defaultValue={service.expectedVersion ?? ""}
              className={`${inputClass} mt-2`}
            />
            <FieldErrors errors={updateState.fieldErrors.expectedVersion} />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <div>
            <p className="text-sm font-semibold text-slate-950">
              Active monitoring
            </p>
            <p className="mt-1 text-sm font-medium text-slate-500">
              {service.isActive ? "Enabled" : "Disabled"}
            </p>
          </div>
          <SaveButton disabled={!canManage} />
        </div>
      </form>

      <form
        action={service.isActive ? deactivateAction : reactivateAction}
        onSubmit={(event) => {
          if (
            service.isActive &&
            !window.confirm("Deactivate monitoring for this service?")
          ) {
            event.preventDefault();
          }
        }}
        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
      >
        <input type="hidden" name="serviceId" value={service.id} />
        <div>
          <p className="text-sm font-semibold text-slate-950">
            Monitoring state
          </p>
          <p
            className={`mt-1 text-sm font-semibold ${service.isActive ? "text-emerald-600" : "text-slate-500"}`}
          >
            {service.isActive ? "Active" : "Inactive"}
          </p>
          <FieldErrors errors={monitoringState.fieldErrors.isActive} />
          {monitoringState.message ? (
            <p
              className={`mt-1 text-xs font-semibold ${monitoringState.ok ? "text-emerald-600" : "text-rose-600"}`}
              role="status"
            >
              {monitoringState.message}
            </p>
          ) : null}
        </div>
        <MonitoringButton active={service.isActive} disabled={!canManage} />
      </form>
    </div>
  );
}
