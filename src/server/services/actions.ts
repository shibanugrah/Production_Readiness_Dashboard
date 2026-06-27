"use server";

import { revalidatePath } from "next/cache";

import { getCurrentWorkspaceContext } from "@/server/auth/context";
import { PermissionDeniedError } from "@/server/auth/permissions";
import {
  ServiceMutationValidationError,
  ServiceNotFoundError,
  createManagedService,
  deactivateManagedService,
  formDataToServiceInput,
  reactivateManagedService,
  updateManagedService,
} from "@/server/services/management";

export type ServiceActionState = {
  ok: boolean;
  message: string | null;
  fieldErrors: Record<string, string[]>;
  serviceId?: string;
};

function revalidateServiceViews(serviceId?: string) {
  revalidatePath("/");
  revalidatePath("/services");

  if (serviceId) {
    revalidatePath(`/services/${serviceId}`);
  }
}

function actionErrorState(error: unknown): ServiceActionState {
  if (error instanceof ServiceMutationValidationError) {
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

  if (error instanceof ServiceNotFoundError) {
    return {
      ok: false,
      message: "Service was not found in this workspace.",
      fieldErrors: {},
    };
  }

  return {
    ok: false,
    message: "Service changes could not be saved.",
    fieldErrors: {},
  };
}

async function requireCurrentWorkspace() {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    throw new PermissionDeniedError("Sign in to manage services.");
  }

  return context;
}

export async function createServiceAction(
  _previousState: ServiceActionState,
  formData: FormData,
): Promise<ServiceActionState> {
  try {
    const context = await requireCurrentWorkspace();
    const service = await createManagedService(
      context,
      formDataToServiceInput(formData),
    );

    revalidateServiceViews(service.id);

    return {
      ok: true,
      message: "Service created.",
      fieldErrors: {},
      serviceId: service.id,
    };
  } catch (error) {
    return actionErrorState(error);
  }
}

export async function updateServiceConfigurationAction(
  _previousState: ServiceActionState,
  formData: FormData,
): Promise<ServiceActionState> {
  const serviceId = String(formData.get("serviceId") ?? "");

  try {
    const context = await requireCurrentWorkspace();
    await updateManagedService(context, serviceId, formDataToServiceInput(formData));

    revalidateServiceViews(serviceId);

    return {
      ok: true,
      message: "Configuration updated.",
      fieldErrors: {},
      serviceId,
    };
  } catch (error) {
    return actionErrorState(error);
  }
}

export async function deactivateServiceAction(
  _previousState: ServiceActionState,
  formData: FormData,
): Promise<ServiceActionState> {
  const serviceId = String(formData.get("serviceId") ?? "");

  try {
    const context = await requireCurrentWorkspace();
    await deactivateManagedService(context, serviceId);

    revalidateServiceViews(serviceId);

    return {
      ok: true,
      message: "Service deactivated.",
      fieldErrors: {},
      serviceId,
    };
  } catch (error) {
    return actionErrorState(error);
  }
}

export async function reactivateServiceAction(
  _previousState: ServiceActionState,
  formData: FormData,
): Promise<ServiceActionState> {
  const serviceId = String(formData.get("serviceId") ?? "");

  try {
    const context = await requireCurrentWorkspace();
    await reactivateManagedService(context, serviceId);

    revalidateServiceViews(serviceId);

    return {
      ok: true,
      message: "Service reactivated.",
      fieldErrors: {},
      serviceId,
    };
  } catch (error) {
    return actionErrorState(error);
  }
}
