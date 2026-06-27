"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { FormField } from "@/components/dashboard/primitives";
import {
  EventIngestKeyActionState,
  createEventIngestKeyAction,
  revokeEventIngestKeyAction,
} from "@/server/operational-events/actions";

const initialState: EventIngestKeyActionState = {
  ok: false,
  message: null,
  fieldErrors: {},
};

const inputClass =
  "h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100";

function SubmitButton({
  children,
  pendingText,
  variant = "primary",
  disabled = false,
}: {
  children: string;
  pendingText: string;
  variant?: "primary" | "secondary";
  disabled?: boolean;
}) {
  const status = useFormStatus();
  const className =
    variant === "primary"
      ? "inline-flex h-10 items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm shadow-blue-100 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      : "inline-flex h-9 items-center justify-center rounded-md border border-rose-200 bg-white px-3 text-sm font-semibold text-rose-600 shadow-sm hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <button type="submit" disabled={disabled || status.pending} className={className}>
      {status.pending ? pendingText : children}
    </button>
  );
}

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

export function CreateEventIngestKeyForm({ enabled }: { enabled: boolean }) {
  const [state, formAction] = useActionState(
    createEventIngestKeyAction,
    initialState,
  );

  if (!enabled) {
    return (
      <p className="text-sm font-medium text-slate-500">
        Event ingestion key management is Owner-only.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <form action={formAction} className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-start">
        <FormField label="Key name">
          <input
            name="name"
            required
            className={inputClass}
            placeholder="Local demo events"
          />
          <FieldErrors errors={state.fieldErrors.name} />
        </FormField>
        <FormField label="Source">
          <input
            name="source"
            required
            className={inputClass}
            placeholder="local-demo"
          />
          <FieldErrors errors={state.fieldErrors.source} />
        </FormField>
        <div className="pt-7">
          <SubmitButton pendingText="Creating...">Create key</SubmitButton>
        </div>
      </form>
      {state.message ? (
        <p className={`text-sm font-semibold ${state.ok ? "text-slate-700" : "text-rose-600"}`}>
          {state.message}
        </p>
      ) : null}
      {state.createdKey ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-semibold text-amber-900">
            Copy this key now. It will not be shown again.
          </p>
          <code className="mt-2 block break-all rounded-md bg-white px-3 py-2 text-xs font-semibold text-slate-800">
            {state.createdKey}
          </code>
        </div>
      ) : null}
    </div>
  );
}

export function RevokeEventIngestKeyForm({
  keyId,
  disabled,
}: {
  keyId: string;
  disabled: boolean;
}) {
  const [, formAction] = useActionState(
    revokeEventIngestKeyAction,
    initialState,
  );

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (
          !window.confirm(
            "Revoke this event ingestion key? Future requests using it will fail.",
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="keyId" value={keyId} />
      <SubmitButton
        variant="secondary"
        pendingText="Revoking..."
        disabled={disabled}
      >
        Revoke
      </SubmitButton>
    </form>
  );
}
