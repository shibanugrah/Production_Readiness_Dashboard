"use server";

import { revalidatePath } from "next/cache";

import { getCurrentWorkspaceContext } from "@/server/auth/context";
import { PermissionDeniedError } from "@/server/auth/permissions";
import {
  EventIngestKeyNotFoundError,
  EventIngestKeyValidationError,
  createOperationalEventIngestKey,
  parseEventIngestKeyFormData,
  revokeOperationalEventIngestKey,
} from "@/server/operational-events/ingest-keys";

export type EventIngestKeyActionState = {
  ok: boolean;
  message: string | null;
  fieldErrors: Record<string, string[]>;
  createdKey?: string;
};

function errorState(error: unknown): EventIngestKeyActionState {
  if (error instanceof EventIngestKeyValidationError) {
    return {
      ok: false,
      message: "Check the highlighted fields.",
      fieldErrors: error.fieldErrors,
    };
  }

  if (error instanceof PermissionDeniedError) {
    return {
      ok: false,
      message: error.message,
      fieldErrors: {},
    };
  }

  if (error instanceof EventIngestKeyNotFoundError) {
    return {
      ok: false,
      message: "Event ingestion key was not found in this workspace.",
      fieldErrors: {},
    };
  }

  return {
    ok: false,
    message: "Event ingestion key change could not be saved.",
    fieldErrors: {},
  };
}

async function requireCurrentWorkspace() {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    throw new PermissionDeniedError("Sign in to manage event ingestion keys.");
  }

  return context;
}

function revalidateSettingsAndEvents() {
  revalidatePath("/settings");
  revalidatePath("/events");
  revalidatePath("/");
}

export async function createEventIngestKeyAction(
  _previousState: EventIngestKeyActionState,
  formData: FormData,
): Promise<EventIngestKeyActionState> {
  try {
    const context = await requireCurrentWorkspace();
    const created = await createOperationalEventIngestKey(
      context,
      parseEventIngestKeyFormData(formData),
    );

    revalidateSettingsAndEvents();

    return {
      ok: true,
      message: "Copy this key now. It will not be shown again.",
      fieldErrors: {},
      createdKey: created.token,
    };
  } catch (error) {
    return errorState(error);
  }
}

export async function revokeEventIngestKeyAction(
  _previousState: EventIngestKeyActionState,
  formData: FormData,
): Promise<EventIngestKeyActionState> {
  try {
    const context = await requireCurrentWorkspace();
    await revokeOperationalEventIngestKey(
      context,
      String(formData.get("keyId") ?? ""),
    );

    revalidateSettingsAndEvents();

    return {
      ok: true,
      message: "Event ingestion key revoked.",
      fieldErrors: {},
    };
  } catch (error) {
    return errorState(error);
  }
}
