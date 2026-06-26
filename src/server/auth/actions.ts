"use server";

import { redirect } from "next/navigation";

import { prisma } from "@/server/db";
import { verifyPassword } from "@/server/auth/password";
import {
  createSession,
  destroyCurrentSession,
  setSessionCookie,
} from "@/server/auth/session";

function isSafeReturnPath(path: string | null) {
  return path?.startsWith("/") && !path.startsWith("//");
}

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const rawReturnPath = formData.get("returnPath");
  const returnPath = isSafeReturnPath(
    typeof rawReturnPath === "string" ? rawReturnPath : null,
  )
    ? (rawReturnPath as string)
    : "/";

  const user = await prisma.user.findUnique({ where: { email } });
  const passwordMatches = await verifyPassword(password, user?.passwordHash ?? null);

  if (!user || !passwordMatches) {
    redirect(`/signin?error=invalid&returnPath=${encodeURIComponent(returnPath)}`);
  }

  const session = await createSession(user.id);
  await setSessionCookie(session.token, session.expiresAt);
  redirect(returnPath);
}

export async function signOutAction() {
  await destroyCurrentSession();
  redirect("/signin?signedOut=1");
}
