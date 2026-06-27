import { ServiceEnvironment } from "@prisma/client";
import { z } from "zod";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export const serviceSlugSchema = z
  .string()
  .min(1)
  .transform(normalizeSlug)
  .pipe(
    z
      .string()
      .min(1, "Slug is required.")
      .regex(
        slugPattern,
        "Slug can only contain lowercase letters, numbers, and hyphens.",
      ),
  );

const serviceUrlSchema = z.string().url().refine(
  (value) => {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  },
  { message: "Service URL must use http or https." },
);

export const serviceInputSchema = z
  .object({
    name: z.string().trim().min(1),
    slug: serviceSlugSchema,
    baseUrl: serviceUrlSchema,
    healthPath: z.string().trim().min(1).startsWith("/"),
    environment: z.nativeEnum(ServiceEnvironment),
    expectedVersion: z.string().trim().min(1).optional(),
  })
  .strict();

export type ServiceInput = z.input<typeof serviceInputSchema>;
export type ValidatedServiceInput = z.output<typeof serviceInputSchema>;

export function validateServiceInput(input: ServiceInput) {
  return serviceInputSchema.parse(input);
}

export function getServiceInputFieldErrors(input: ServiceInput) {
  const parsed = serviceInputSchema.safeParse(input);

  if (parsed.success) {
    return null;
  }

  return parsed.error.flatten().fieldErrors;
}
