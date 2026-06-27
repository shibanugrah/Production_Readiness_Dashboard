import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createServiceAction,
  deactivateServiceAction,
  reactivateServiceAction,
  updateServiceConfigurationAction,
} from "@/server/services/actions";
import { getCurrentWorkspaceContext } from "@/server/auth/context";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/server/auth/context", () => ({
  getCurrentWorkspaceContext: vi.fn(),
}));

const initialServiceActionState = {
  ok: false,
  message: null,
  fieldErrors: {},
};

function serviceFormData() {
  const formData = new FormData();
  formData.set("serviceId", "service_1");
  formData.set("name", "Payments API");
  formData.set("slug", "payments-api");
  formData.set("baseUrl", "https://payments.example.test");
  formData.set("healthPath", "/health");
  formData.set("environment", "STAGING");
  formData.set("expectedVersion", "2026.06");
  return formData;
}

describe("service server actions", () => {
  beforeEach(() => {
    vi.mocked(getCurrentWorkspaceContext).mockResolvedValue(null);
  });

  it("denies unauthenticated service mutation attempts", async () => {
    const formData = serviceFormData();

    await expect(
      createServiceAction(initialServiceActionState, formData),
    ).resolves.toMatchObject({
      ok: false,
      message: "Sign in to manage services.",
    });
    await expect(
      updateServiceConfigurationAction(initialServiceActionState, formData),
    ).resolves.toMatchObject({
      ok: false,
      message: "Sign in to manage services.",
    });
    await expect(
      deactivateServiceAction(initialServiceActionState, formData),
    ).resolves.toMatchObject({
      ok: false,
      message: "Sign in to manage services.",
    });
    await expect(
      reactivateServiceAction(initialServiceActionState, formData),
    ).resolves.toMatchObject({
      ok: false,
      message: "Sign in to manage services.",
    });
  });
});
