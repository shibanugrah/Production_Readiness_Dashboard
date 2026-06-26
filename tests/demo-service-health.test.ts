import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/demo-service/health/route";

async function callDemoHealth(mode: string) {
  const response = await GET(
    new Request(`http://localhost:3000/api/demo-service/health?mode=${mode}`),
  );
  const body = await response.json();

  return { response, body };
}

describe("demo monitored health endpoint", () => {
  it("returns a valid healthy response", async () => {
    const { response, body } = await callDemoHealth("healthy");

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: "ok",
      service: "demo-monitored-service",
      version: "local-demo",
    });
    expect(Date.parse(body.timestamp)).not.toBeNaN();
  });

  it("returns a delayed valid response for slow mode", async () => {
    const startedAt = Date.now();
    const { response, body } = await callDemoHealth("slow");

    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(1_900);
    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
  });

  it("returns a safe unavailable response for down mode", async () => {
    const { response, body } = await callDemoHealth("down");

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      status: "error",
      service: "demo-monitored-service",
    });
  });

  it("returns an intentionally invalid health payload for invalid mode", async () => {
    const { response, body } = await callDemoHealth("invalid");

    expect(response.status).toBe(200);
    expect(body.service).toBe("demo-monitored-service");
    expect(body.status).not.toBe("ok");
  });

  it("returns HTTP 400 for unsupported modes", async () => {
    const { response, body } = await callDemoHealth("surprise");

    expect(response.status).toBe(400);
    expect(body.error).toBe("unsupported demo health mode");
  });

  it("does not allow controllable demo modes in production", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalDemoEnabled = process.env.DEMO_SERVICE_HEALTH_ENABLED;
    Reflect.set(process.env, "NODE_ENV", "production");
    delete process.env.DEMO_SERVICE_HEALTH_ENABLED;

    try {
      const { response, body } = await callDemoHealth("healthy");

      expect(response.status).toBe(404);
      expect(body.error).toBe("demo health endpoint is disabled");
    } finally {
      Reflect.set(process.env, "NODE_ENV", originalNodeEnv);
      if (originalDemoEnabled === undefined) {
        delete process.env.DEMO_SERVICE_HEALTH_ENABLED;
      } else {
        process.env.DEMO_SERVICE_HEALTH_ENABLED = originalDemoEnabled;
      }
    }
  });
});
