"use server";

import { ServiceEnvironment } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { runHealthChecks } from "@/server/health-checks/runner";
import { createService } from "@/server/services/repository";
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
    await createService(dashboard.context, {
      name: String(formData.get("name") ?? ""),
      slug: String(formData.get("slug") ?? ""),
      baseUrl: String(formData.get("baseUrl") ?? ""),
      healthPath: String(formData.get("healthPath") ?? ""),
      environment: String(formData.get("environment") ?? "") as ServiceEnvironment,
      expectedVersion:
        String(formData.get("expectedVersion") ?? "").trim() || undefined,
    });
    revalidatePath("/services");
    revalidatePath("/");
  } catch {
    redirect(`${returnPath}?service=error`);
  }

  redirect(`${returnPath}?service=created`);
}
