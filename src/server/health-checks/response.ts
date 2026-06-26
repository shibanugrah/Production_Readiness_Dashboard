import { z } from "zod";

import { ValidHealthPayload } from "@/server/health-checks/types";

const isoTimestampSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: "timestamp must be ISO-8601 compatible",
});

const healthPayloadSchema = z
  .object({
    status: z.literal("ok"),
    service: z.string().min(1).optional(),
    version: z.string().min(1).optional(),
    migrationVersion: z.string().min(1).optional(),
    timestamp: isoTimestampSchema.optional(),
  })
  .passthrough();

export function validateHealthPayload(payload: unknown): ValidHealthPayload {
  return healthPayloadSchema.parse(payload);
}

export function safeValidateHealthPayload(payload: unknown) {
  const result = healthPayloadSchema.safeParse(payload);

  if (!result.success) {
    return null;
  }

  return result.data;
}
