import {
  OperationalEventSeverity,
  OperationalEventStatus,
  OperationalEventType,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/internal/operational-events/route";
import {
  EventIngestionAuthError,
  EventIngestionConflictError,
  EventIngestionValidationError,
  authenticateOperationalEventIngestKey,
  ingestOperationalEvent,
} from "@/server/operational-events/ingestion";

vi.mock("@/server/operational-events/ingestion", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/server/operational-events/ingestion")>();

  return {
    ...actual,
    authenticateOperationalEventIngestKey: vi.fn(),
    ingestOperationalEvent: vi.fn(),
  };
});

const mockedAuthenticate = vi.mocked(authenticateOperationalEventIngestKey);
const mockedIngest = vi.mocked(ingestOperationalEvent);

function request(body: unknown = validPayload()) {
  return new Request("http://localhost/api/internal/operational-events", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function validPayload() {
  return {
    type: OperationalEventType.JOB,
    severity: OperationalEventSeverity.ERROR,
    idempotencyKey: "job-123",
    occurredAt: "2026-06-27T00:00:00.000Z",
  };
}

function eventFixture() {
  return {
    id: "event_1",
    workspaceId: "workspace_1",
    serviceId: null,
    source: "local-demo",
    type: OperationalEventType.JOB,
    severity: OperationalEventSeverity.ERROR,
    status: OperationalEventStatus.OPEN,
    message: "Job failed",
    externalReference: null,
    errorMessage: null,
    metadata: null,
    payloadHash: "hash",
    idempotencyKey: "job-123",
    occurredAt: new Date("2026-06-27T00:00:00.000Z"),
    createdAt: new Date("2026-06-27T00:00:01.000Z"),
  };
}

describe("operational event route", () => {
  beforeEach(() => {
    mockedAuthenticate.mockReset();
    mockedIngest.mockReset();
    mockedAuthenticate.mockResolvedValue({
      id: "key_1",
      workspaceId: "workspace_1",
      source: "local-demo",
    });
    mockedIngest.mockResolvedValue({
      event: eventFixture(),
      replayed: false,
    });
  });

  it("returns 201 for a newly accepted event", async () => {
    const response = await POST(request());

    await expect(response.json()).resolves.toMatchObject({
      event: {
        id: "event_1",
        workspaceId: "workspace_1",
        source: "local-demo",
      },
      replayed: false,
    });
    expect(response.status).toBe(201);
  });

  it("returns 200 for idempotent replay", async () => {
    mockedIngest.mockResolvedValueOnce({
      event: eventFixture(),
      replayed: true,
    });

    const response = await POST(request());

    expect(response.status).toBe(200);
  });

  it("returns 409 for idempotency conflicts", async () => {
    mockedIngest.mockRejectedValueOnce(new EventIngestionConflictError("event_1"));

    const response = await POST(request());

    await expect(response.json()).resolves.toMatchObject({
      eventId: "event_1",
    });
    expect(response.status).toBe(409);
  });

  it("returns safe auth and validation errors", async () => {
    mockedAuthenticate.mockRejectedValueOnce(
      new EventIngestionAuthError("Invalid event ingestion key.", 403),
    );

    const denied = await POST(request());
    expect(denied.status).toBe(403);

    mockedAuthenticate.mockResolvedValueOnce({
      id: "key_1",
      workspaceId: "workspace_1",
      source: "local-demo",
    });
    mockedIngest.mockRejectedValueOnce(
      new EventIngestionValidationError({ payload: ["Payload is unsafe."] }),
    );

    const invalid = await POST(request());
    await expect(invalid.json()).resolves.toEqual({
      error: "validation failed",
      fieldErrors: { payload: ["Payload is unsafe."] },
    });
    expect(invalid.status).toBe(400);
  });
});
