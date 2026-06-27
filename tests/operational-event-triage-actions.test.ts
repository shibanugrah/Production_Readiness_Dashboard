import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentWorkspaceContext } from "@/server/auth/context";
import {
  acknowledgeOperationalEventAction,
  createIncidentFromOperationalEventAction,
  reopenOperationalEventAction,
  resolveIncidentAction,
  resolveOperationalEventAction,
} from "@/server/operational-events/triage-actions";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/server/auth/context", () => ({
  getCurrentWorkspaceContext: vi.fn(),
}));

const initialState = {
  ok: false,
  message: null,
  fieldErrors: {},
};

function eventFormData() {
  const formData = new FormData();
  formData.set("eventId", "event_1");
  formData.set("resolutionNote", "Resolved after upstream recovery.");
  formData.set("reopenReason", "The failure returned.");
  return formData;
}

function incidentFormData() {
  const formData = new FormData();
  formData.set("incidentId", "incident_1");
  formData.set("resolutionNotes", "Incident resolved after verification.");
  return formData;
}

describe("operational event triage server actions", () => {
  beforeEach(() => {
    vi.mocked(getCurrentWorkspaceContext).mockResolvedValue(null);
  });

  it("denies unauthenticated event and incident triage attempts", async () => {
    const eventData = eventFormData();
    const incidentData = incidentFormData();

    await expect(
      acknowledgeOperationalEventAction(initialState, eventData),
    ).resolves.toMatchObject({
      ok: false,
      message: "Sign in to triage operational events.",
    });
    await expect(
      resolveOperationalEventAction(initialState, eventData),
    ).resolves.toMatchObject({
      ok: false,
      message: "Sign in to triage operational events.",
    });
    await expect(
      reopenOperationalEventAction(initialState, eventData),
    ).resolves.toMatchObject({
      ok: false,
      message: "Sign in to triage operational events.",
    });
    await expect(
      createIncidentFromOperationalEventAction(initialState, eventData),
    ).resolves.toMatchObject({
      ok: false,
      message: "Sign in to triage operational events.",
    });
    await expect(
      resolveIncidentAction(initialState, incidentData),
    ).resolves.toMatchObject({
      ok: false,
      message: "Sign in to triage operational events.",
    });
  });
});
