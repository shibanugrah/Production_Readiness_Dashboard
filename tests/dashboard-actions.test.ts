import { describe, expect, it } from "vitest";

import { isLocalDemoActionsEnabled } from "@/server/dashboard/local-demo";

describe("dashboard local action guards", () => {
  it("enables local actions only for explicit local demo mode", () => {
    expect(
      isLocalDemoActionsEnabled({
        APP_VERSION: "local",
        HEALTH_CHECK_LOCAL_ALLOWLIST_ENABLED: "true",
      } as unknown as NodeJS.ProcessEnv),
    ).toBe(true);

    expect(
      isLocalDemoActionsEnabled({
        APP_VERSION: "production",
        HEALTH_CHECK_LOCAL_ALLOWLIST_ENABLED: "true",
      } as unknown as NodeJS.ProcessEnv),
    ).toBe(false);

    expect(
      isLocalDemoActionsEnabled({
        APP_VERSION: "local",
        HEALTH_CHECK_LOCAL_ALLOWLIST_ENABLED: "false",
      } as unknown as NodeJS.ProcessEnv),
    ).toBe(false);
  });
});
