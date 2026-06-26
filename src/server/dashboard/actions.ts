"use server";

import { ServiceEnvironment } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { runHealthChecks } from "@/server/health-checks/runner";
import { createService } from "@/server/services/repository";
import { getTrustedDashboardContext } from "@/server/dashboard/read-models";
import { isLocalDemoActionsEnabled } from "@/server/dashboard/local-demo";

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

  if (!isLocalDemoActionsEnabled()) {
    redirect(`${returnPath}?checks=disabled`);
  }

  try {
    await runHealthChecks();
    revalidatePath("/");
    revalidatePath("/services");
    redirect(`${returnPath}?checks=success`);
  } catch {
    redirect(`${returnPath}?checks=error`);
  }
}

export async function addLocalDemoServiceAction(formData: FormData) {
  const returnPath = getReturnPath(formData);

  if (!isLocalDemoActionsEnabled()) {
    redirect(`${returnPath}?service=disabled`);
  }

  const trusted = await getTrustedDashboardContext();

  if (!trusted) {
    redirect(`${returnPath}?service=error`);
  }

  try {
    await createService(trusted.context, {
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
    redirect(`${returnPath}?service=created`);
  } catch {
    redirect(`${returnPath}?service=error`);
  }
}
