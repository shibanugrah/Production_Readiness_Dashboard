import { createHash, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { runHealthChecks } from "@/server/health-checks/runner";

function getProvidedSecret(request: Request) {
  const directSecret = request.headers.get("x-internal-health-check-secret");

  if (directSecret) {
    return directSecret;
  }

  const authorization = request.headers.get("authorization");
  const bearerPrefix = "Bearer ";

  if (authorization?.startsWith(bearerPrefix)) {
    return authorization.slice(bearerPrefix.length);
  }

  return null;
}

function hashSecret(secret: string) {
  return createHash("sha256").update(secret).digest();
}

function secretsMatch(providedSecret: string, expectedSecret: string) {
  return timingSafeEqual(hashSecret(providedSecret), hashSecret(expectedSecret));
}

export async function POST(request: Request) {
  const expectedSecret = process.env.INTERNAL_HEALTH_CHECK_SECRET;

  if (!expectedSecret) {
    return NextResponse.json(
      { error: "internal health check secret is not configured" },
      { status: 503 },
    );
  }

  const providedSecret = getProvidedSecret(request);

  if (!providedSecret) {
    return NextResponse.json({ error: "missing internal secret" }, { status: 401 });
  }

  if (!secretsMatch(providedSecret, expectedSecret)) {
    return NextResponse.json({ error: "invalid internal secret" }, { status: 403 });
  }

  const summary = await runHealthChecks();

  return NextResponse.json(summary);
}
