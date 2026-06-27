"use server";

import { revalidatePath } from "next/cache";

import { getCurrentWorkspaceContext } from "@/server/auth/context";
import { PermissionDeniedError } from "@/server/auth/permissions";
import {
  DuplicateIncidentError,
  EventTriageNotFoundError,
  EventTriageValidationError,
  IncidentNotFoundError,
  acknowledgeOperationalEvent,
  createIncidentFromOperationalEvent,
  reopenOperationalEvent,
  resolveIncident,
  resolveOperationalEvent,
} from "@/server/operational-events/triage";

export type TriageActionState = {
  ok: boolean;
  message: string | null;
  fieldErrors: Record<string, string[]>;
  incidentId?: string;
};

const initialErrorState = {
  ok: false,
  message: null,
  fieldErrors: {},
};

function actionErrorState(error: unknown): TriageActionState {
  if (error instanceof EventTriageValidationError) {
    return {
      ...initialErrorState,
      message: "Check the highlighted fields.",
      fieldErrors: error.fieldErrors,
    };
  }

  if (error instanceof PermissionDeniedError) {
    return {
      ...initialErrorState,
      message: error.message,
    };
  }

  if (
    error instanceof EventTriageNotFoundError ||
    error instanceof IncidentNotFoundError
  ) {
    return {
      ...initialErrorState,
      message: error.message,
    };
  }

  if (error instanceof DuplicateIncidentError) {
    return {
      ok: false,
      message: error.message,
      fieldErrors: {},
      incidentId: error.incidentId,
    };
  }

  return {
    ...initialErrorState,
    message: "Triage action could not be completed.",
  };
}

async function requireCurrentWorkspace() {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    throw new PermissionDeniedError("Sign in to triage operational events.");
  }

  return context;
}

function revalidateTriageViews(eventId?: string, incidentId?: string) {
  revalidatePath("/");
  revalidatePath("/events");
  revalidatePath("/incidents");

  if (eventId) {
    revalidatePath(`/events?eventId=${eventId}`);
  }

  if (incidentId) {
    revalidatePath(`/incidents?incidentId=${incidentId}`);
  }
}

function formValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

export async function acknowledgeOperationalEventAction(
  _previousState: TriageActionState,
  formData: FormData,
): Promise<TriageActionState> {
  const eventId = formValue(formData, "eventId");

  try {
    const context = await requireCurrentWorkspace();
    await acknowledgeOperationalEvent(context, eventId);
    revalidateTriageViews(eventId);

    return { ok: true, message: "Event acknowledged.", fieldErrors: {} };
  } catch (error) {
    return actionErrorState(error);
  }
}

export async function resolveOperationalEventAction(
  _previousState: TriageActionState,
  formData: FormData,
): Promise<TriageActionState> {
  const eventId = formValue(formData, "eventId");

  try {
    const context = await requireCurrentWorkspace();
    await resolveOperationalEvent(
      context,
      eventId,
      formValue(formData, "resolutionNote"),
    );
    revalidateTriageViews(eventId);

    return { ok: true, message: "Event resolved.", fieldErrors: {} };
  } catch (error) {
    return actionErrorState(error);
  }
}

export async function reopenOperationalEventAction(
  _previousState: TriageActionState,
  formData: FormData,
): Promise<TriageActionState> {
  const eventId = formValue(formData, "eventId");

  try {
    const context = await requireCurrentWorkspace();
    await reopenOperationalEvent(
      context,
      eventId,
      formValue(formData, "reopenReason"),
    );
    revalidateTriageViews(eventId);

    return { ok: true, message: "Event reopened.", fieldErrors: {} };
  } catch (error) {
    return actionErrorState(error);
  }
}

export async function createIncidentFromOperationalEventAction(
  _previousState: TriageActionState,
  formData: FormData,
): Promise<TriageActionState> {
  const eventId = formValue(formData, "eventId");

  try {
    const context = await requireCurrentWorkspace();
    const incident = await createIncidentFromOperationalEvent(context, eventId);
    revalidateTriageViews(eventId, incident.id);

    return {
      ok: true,
      message: "Incident created.",
      fieldErrors: {},
      incidentId: incident.id,
    };
  } catch (error) {
    return actionErrorState(error);
  }
}

export async function resolveIncidentAction(
  _previousState: TriageActionState,
  formData: FormData,
): Promise<TriageActionState> {
  const incidentId = formValue(formData, "incidentId");

  try {
    const context = await requireCurrentWorkspace();
    await resolveIncident(
      context,
      incidentId,
      formValue(formData, "resolutionNotes"),
    );
    revalidateTriageViews(undefined, incidentId);

    return { ok: true, message: "Incident resolved.", fieldErrors: {} };
  } catch (error) {
    return actionErrorState(error);
  }
}
