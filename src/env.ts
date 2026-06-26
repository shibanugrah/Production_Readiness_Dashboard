import { z } from "zod";

export const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(1),
  INTERNAL_HEALTH_CHECK_SECRET: z.string().min(1),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  APP_VERSION: z.string().min(1).optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

export function validateEnv(environment: NodeJS.ProcessEnv = process.env) {
  return envSchema.parse(environment);
}
