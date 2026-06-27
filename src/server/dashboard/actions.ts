"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { runHealthChecks } from "@/server/health-checks/runner";
import {
  createManagedService,
  formDataToServiceInput,
} from "@/server/services/management";
import { getDashboardContext } from "@/server/dashboard/read-models";
import { isLocalDemoActionsEnabled } from "@/server/dashboard/local-demo";
import { canManageServices, canRunChecks } from "@/server/auth/permissions";

function isSafeReturnPath(path: string | null) {
  return path?.startsWith("/") && !path.startsWith("//");
}

function getReturnPath(formData: FormData) {
  const rawPath = formData.get("returnPath");
  return isSafeReturnPath(typeof rawPath === "string" ? rawPath : null)
    ? (rawPath as string)
    : "/";
}

export async function runLocalChecksAction(formData: FormData) {
  const returnPath = getReturnPath(formData);
  const dashboard = await getDashboardContext();

  if (!dashboard) {
    redirect(`/signin?returnPath=${encodeURIComponent(returnPath)}`);
  }

  if (!canRunChecks(dashboard.context)) {
    redirect(`${returnPath}?checks=denied`);
  }

  if (!isLocalDemoActionsEnabled()) {
    redirect(`${returnPath}?checks=disabled`);
  }

  try {
    await runHealthChecks(undefined, { workspaceId: dashboard.context.workspaceId });
    revalidatePath("/");
    revalidatePath("/services");
  } catch {
    redirect(`${returnPath}?checks=error`);
  }

  redirect(`${returnPath}?checks=success`);
}

export async function addLocalDemoServiceAction(formData: FormData) {
  const returnPath = getReturnPath(formData);
  const dashboard = await getDashboardContext();

  if (!dashboard) {
    redirect(`/signin?returnPath=${encodeURIComponent(returnPath)}`);
  }

  if (!canManageServices(dashboard.context)) {
    redirect(`${returnPath}?service=denied`);
  }

  if (!isLocalDemoActionsEnabled()) {
    redirect(`${returnPath}?service=disabled`);
  }

  try {
    const service = await createManagedService(
      dashboard.context,
      formDataToServiceInput(formData),
    );
    revalidatePath("/services");
    revalidatePath("/");
    revalidatePath(`/services/${service.id}`);
  } catch {
    redirect(`${returnPath}?service=error`);
  }

  redirect(`${returnPath}?service=created`);
}
