import { NextResponse } from "next/server";

import {
  EventIngestionAuthError,
  EventIngestionConflictError,
  EventIngestionValidationError,
  authenticateOperationalEventIngestKey,
  ingestOperationalEvent,
  maxOperationalEventBodyBytes,
} from "@/server/operational-events/ingestion";

function safeEventResponse(event: {
  id: string;
  workspaceId: string;
  source: string;
  type: string;
  severity: string;
  status: string;
  occurredAt: Date;
  createdAt: Date;
}) {
  return {
    id: event.id,
    workspaceId: event.workspaceId,
    source: event.source,
    type: event.type,
    severity: event.severity,
    status: event.status,
    occurredAt: event.occurredAt.toISOString(),
    createdAt: event.createdAt.toISOString(),
  };
}

export async function POST(request: Request) {
  let authenticatedKey;

  try {
    authenticatedKey = await authenticateOperationalEventIngestKey(request);
  } catch (error) {
    if (error instanceof EventIngestionAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }

  const bodyText = await request.text();

  if (Buffer.byteLength(bodyText, "utf8") > maxOperationalEventBodyBytes()) {
    return NextResponse.json(
      {
        error: "request body is too large",
        fieldErrors: { body: ["Request body exceeds the maximum supported size."] },
      },
      { status: 400 },
    );
  }

  let body: unknown;

  try {
    body = JSON.parse(bodyText);
  } catch {
    return NextResponse.json(
      {
        error: "invalid json",
        fieldErrors: { body: ["Request body must be valid JSON."] },
      },
      { status: 400 },
    );
  }

  try {
    const result = await ingestOperationalEvent(authenticatedKey, body);

    return NextResponse.json(
      {
        event: safeEventResponse(result.event),
        replayed: result.replayed,
      },
      { status: result.replayed ? 200 : 201 },
    );
  } catch (error) {
    if (error instanceof EventIngestionValidationError) {
      return NextResponse.json(
        {
          error: "validation failed",
          fieldErrors: error.fieldErrors,
        },
        { status: 400 },
      );
    }

    if (error instanceof EventIngestionConflictError) {
      return NextResponse.json(
        {
          error: error.message,
          eventId: error.eventId,
        },
        { status: 409 },
      );
    }

    throw error;
  }
}
