"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  TriageActionState,
  acknowledgeOperationalEventAction,
  createIncidentFromOperationalEventAction,
  reopenOperationalEventAction,
  resolveIncidentAction,
  resolveOperationalEventAction,
} from "@/server/operational-events/triage-actions";

const initialState: TriageActionState = {
  ok: false,
  message: null,
  fieldErrors: {},
};

const buttonClass =
  "inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";
const primaryButtonClass =
  "inline-flex h-9 items-center justify-center rounded-md bg-blue-600 px-3 text-sm font-semibold text-white shadow-sm shadow-blue-100 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const dangerButtonClass =
  "inline-flex h-9 items-center justify-center rounded-md border border-rose-200 bg-white px-3 text-sm font-semibold text-rose-600 shadow-sm hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60";
const textareaClass =
  "min-h-20 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100";

function SubmitButton({
  children,
  pendingText,
  variant = "default",
}: {
  children: string;
  pendingText: string;
  variant?: "default" | "primary" | "danger";
}) {
  const status = useFormStatus();
  const className =
    variant === "primary"
      ? primaryButtonClass
      : variant === "danger"
        ? dangerButtonClass
        : buttonClass;

  return (
    <button type="submit" disabled={status.pending} className={className}>
      {status.pending ? pendingText : children}
    </button>
  );
}

function ActionMessage({ state }: { state: TriageActionState }) {
  if (!state.message) {
    return null;
  }

  return (
    <p className={`text-sm font-semibold ${state.ok ? "text-slate-600" : "text-rose-600"}`}>
      {state.message}
    </p>
  );
}

export function EventTriageControls({
  eventId,
  status,
  incidentId,
}: {
  eventId: string;
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
  incidentId?: string | null;
}) {
  const [ackState, ackAction] = useActionState(
    acknowledgeOperationalEventAction,
    initialState,
  );
  const [resolveState, resolveAction] = useActionState(
    resolveOperationalEventAction,
    initialState,
  );
  const [reopenState, reopenAction] = useActionState(
    reopenOperationalEventAction,
    initialState,
  );
  const [incidentState, incidentAction] = useActionState(
    createIncidentFromOperationalEventAction,
    initialState,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {status === "OPEN" ? (
          <form
            action={ackAction}
            onSubmit={(event) => {
              if (!window.confirm("Acknowledge this operational event?")) {
                event.preventDefault();
              }
            }}
          >
            <input type="hidden" name="eventId" value={eventId} />
            <SubmitButton pendingText="Acknowledging...">
              Acknowledge
            </SubmitButton>
          </form>
        ) : null}
        {incidentId ? (
          <a className={buttonClass} href={`/incidents?incidentId=${incidentId}`}>
            View incident
          </a>
        ) : status !== "RESOLVED" ? (
          <form
            action={incidentAction}
            onSubmit={(event) => {
              if (!window.confirm("Create an incident from this event?")) {
                event.preventDefault();
              }
            }}
          >
            <input type="hidden" name="eventId" value={eventId} />
            <SubmitButton variant="primary" pendingText="Creating...">
              Create incident
            </SubmitButton>
          </form>
        ) : null}
      </div>

      {status === "OPEN" || status === "ACKNOWLEDGED" ? (
        <form
          action={resolveAction}
          className="space-y-2"
          onSubmit={(event) => {
            if (!window.confirm("Resolve this operational event?")) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="eventId" value={eventId} />
          <textarea
            name="resolutionNote"
            required
            maxLength={500}
            className={textareaClass}
            placeholder="Resolution note"
          />
          {resolveState.fieldErrors.resolutionNote ? (
            <p className="text-xs font-semibold text-rose-600">
              {resolveState.fieldErrors.resolutionNote[0]}
            </p>
          ) : null}
          <SubmitButton variant="danger" pendingText="Resolving...">
            Resolve event
          </SubmitButton>
        </form>
      ) : null}

      {status === "RESOLVED" ? (
        <form
          action={reopenAction}
          className="space-y-2"
          onSubmit={(event) => {
            if (!window.confirm("Reopen this operational event?")) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="eventId" value={eventId} />
          <textarea
            name="reopenReason"
            required
            maxLength={500}
            className={textareaClass}
            placeholder="Reopen reason"
          />
          {reopenState.fieldErrors.reopenReason ? (
            <p className="text-xs font-semibold text-rose-600">
              {reopenState.fieldErrors.reopenReason[0]}
            </p>
          ) : null}
          <SubmitButton variant="primary" pendingText="Reopening...">
            Reopen event
          </SubmitButton>
        </form>
      ) : null}

      <ActionMessage state={ackState} />
      <ActionMessage state={resolveState} />
      <ActionMessage state={reopenState} />
      <ActionMessage state={incidentState} />
    </div>
  );
}

export function ResolveIncidentControl({ incidentId }: { incidentId: string }) {
  const [state, action] = useActionState(resolveIncidentAction, initialState);

  return (
    <form
      action={action}
      className="space-y-2"
      onSubmit={(event) => {
        if (!window.confirm("Resolve this incident?")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="incidentId" value={incidentId} />
      <textarea
        name="resolutionNotes"
        required
        maxLength={500}
        className={textareaClass}
        placeholder="Incident resolution notes"
      />
      {state.fieldErrors.resolutionNotes ? (
        <p className="text-xs font-semibold text-rose-600">
          {state.fieldErrors.resolutionNotes[0]}
        </p>
      ) : null}
      <SubmitButton variant="danger" pendingText="Resolving...">
        Resolve incident
      </SubmitButton>
      <ActionMessage state={state} />
    </form>
  );
}
