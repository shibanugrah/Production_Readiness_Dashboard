import { HealthCheckRunStatus, HealthCheckRunTriggerType } from "@prisma/client";
import { NextResponse } from "next/server";

import { runHealthChecks } from "@/server/health-checks/runner";
import {
  getProvidedInternalSecret,
  internalSecretsMatch,
} from "@/server/internal-secret";

export async function POST(request: Request) {
  const expectedSecret = process.env.INTERNAL_HEALTH_CHECK_SECRET;

  if (!expectedSecret) {
    return NextResponse.json(
      { error: "internal health check secret is not configured" },
      { status: 503 },
    );
  }

  const providedSecret = getProvidedInternalSecret(request);

  if (!providedSecret) {
    return NextResponse.json({ error: "missing internal secret" }, { status: 401 });
  }

  if (!internalSecretsMatch(providedSecret, expectedSecret)) {
    return NextResponse.json({ error: "invalid internal secret" }, { status: 403 });
  }

  const summary = await runHealthChecks(undefined, {
    triggerType: HealthCheckRunTriggerType.SCHEDULED,
    requestedByUserId: null,
  });

  if (summary.status === HealthCheckRunStatus.SKIPPED) {
    return NextResponse.json(
      {
        ...summary,
        message: "Another health-check run is already active for this workspace.",
      },
      { status: 409 },
    );
  }

  return NextResponse.json(summary);
}
