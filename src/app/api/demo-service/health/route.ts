import { NextResponse } from "next/server";

type DemoHealthMode = "healthy" | "slow" | "down" | "invalid";

const demoServiceName = "demo-monitored-service";

function buildHealthyPayload() {
  return {
    status: "ok",
    service: demoServiceName,
    version: "local-demo",
    timestamp: new Date().toISOString(),
  };
}

function isDemoHealthMode(value: string): value is DemoHealthMode {
  return value === "healthy" || value === "slow" || value === "down" || value === "invalid";
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export async function GET(request: Request) {
  const demoHealthModesEnabled =
    process.env["DEMO_SERVICE_HEALTH_ENABLED"] === "true" ||
    process.env["NODE_ENV"] !== "production";

  if (!demoHealthModesEnabled) {
    return NextResponse.json(
      { error: "demo health endpoint is disabled" },
      { status: 404 },
    );
  }

  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") ?? "healthy";

  if (!isDemoHealthMode(mode)) {
    return NextResponse.json(
      { error: "unsupported demo health mode" },
      { status: 400 },
    );
  }

  if (mode === "slow") {
    await sleep(2_000);
    return NextResponse.json(buildHealthyPayload());
  }

  if (mode === "down") {
    return NextResponse.json(
      {
        status: "error",
        service: demoServiceName,
        message: "demo service is unavailable",
      },
      { status: 503 },
    );
  }

  if (mode === "invalid") {
    return NextResponse.json({
      service: demoServiceName,
      version: "local-demo",
      timestamp: new Date().toISOString(),
    });
  }

  return NextResponse.json(buildHealthyPayload());
}
