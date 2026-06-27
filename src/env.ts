import { z } from "zod";

export const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(1),
  INTERNAL_HEALTH_CHECK_SECRET: z.string().min(1),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  APP_VERSION: z.string().min(1).optional(),
  HEALTH_CHECK_LOCAL_ALLOWLIST_ENABLED: z.string().optional(),
  HEALTH_CHECK_LOCAL_ALLOWED_TARGETS: z.string().optional(),
  DEMO_SERVICE_HEALTH_ENABLED: z.string().optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

export class EnvironmentValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Environment validation failed: ${issues.join(" ")}`);
    this.name = "EnvironmentValidationError";
  }
}

function isPlaceholderLikeSecret(value: string) {
  const normalized = value.trim().toLowerCase();
  const knownUnsafeValues = new Set([
    "auth-secret",
    "internal-secret",
    "ci-auth-secret",
    "ci-health-secret",
    "test-auth-secret",
    "test-health-secret",
  ]);

  return (
    knownUnsafeValues.has(normalized) ||
    normalized.includes("replace-with") ||
    normalized.includes("placeholder") ||
    normalized.includes("changeme") ||
    normalized.includes("change-me") ||
    normalized.includes("example") ||
    normalized.startsWith("your-") ||
    normalized === "local"
  );
}

function validateProductionSecret(
  environment: NodeJS.ProcessEnv,
  variableName: "AUTH_SECRET" | "INTERNAL_HEALTH_CHECK_SECRET",
) {
  const value = environment[variableName]?.trim();

  if (!value) {
    return `${variableName} is required in production. Generate a unique high-entropy value and store it only in the deployment secret store.`;
  }

  if (value.length < 32 || isPlaceholderLikeSecret(value)) {
    return `${variableName} must be a non-placeholder value at least 32 characters long. Generate a fresh production secret and do not commit it.`;
  }

  return null;
}

function validateProductionEnv(environment: NodeJS.ProcessEnv) {
  const issues: string[] = [];
  const databaseUrl = environment.DATABASE_URL?.trim();
  const appVersion = environment.APP_VERSION?.trim();

  if (!databaseUrl) {
    issues.push(
      "DATABASE_URL is required in production. Configure a managed PostgreSQL connection string in the deployment secret store.",
    );
  } else {
    try {
      const parsedUrl = new URL(databaseUrl);

      if (parsedUrl.protocol !== "postgresql:" && parsedUrl.protocol !== "postgres:") {
        issues.push(
          "DATABASE_URL must be a PostgreSQL connection string in production.",
        );
      }
    } catch {
      issues.push(
        "DATABASE_URL must be a valid PostgreSQL connection string in production.",
      );
    }
  }

  for (const variableName of [
    "AUTH_SECRET",
    "INTERNAL_HEALTH_CHECK_SECRET",
  ] as const) {
    const issue = validateProductionSecret(environment, variableName);

    if (issue) {
      issues.push(issue);
    }
  }

  if (!appVersion) {
    issues.push(
      "APP_VERSION is required in production. Set it to the released image, commit, or build identifier.",
    );
  } else if (appVersion.toLowerCase() === "local") {
    issues.push(
      "APP_VERSION must not be 'local' in production. Set it to the released image, commit, or build identifier.",
    );
  }

  if (environment.HEALTH_CHECK_LOCAL_ALLOWLIST_ENABLED === "true") {
    issues.push(
      "HEALTH_CHECK_LOCAL_ALLOWLIST_ENABLED must be false in production. Local/private monitoring targets are development-only.",
    );
  }

  if (environment.HEALTH_CHECK_LOCAL_ALLOWED_TARGETS?.trim()) {
    issues.push(
      "HEALTH_CHECK_LOCAL_ALLOWED_TARGETS must be empty in production. Do not configure local or private monitoring target allowlists.",
    );
  }

  if (environment.DEMO_SERVICE_HEALTH_ENABLED === "true") {
    issues.push(
      "DEMO_SERVICE_HEALTH_ENABLED must not be true in production. Do not expose controllable demo health modes publicly.",
    );
  }

  if (issues.length > 0) {
    throw new EnvironmentValidationError(issues);
  }
}

export function validateEnv(environment: NodeJS.ProcessEnv = process.env) {
  const parsedEnv = envSchema.safeParse(environment);

  if (!parsedEnv.success) {
    const issues = parsedEnv.error.issues.map((issue) => {
      const variableName = issue.path.join(".") || "environment";
      return `${variableName} is invalid or missing. Check the deployment environment template and provide a safe value.`;
    });

    throw new EnvironmentValidationError(issues);
  }

  if (parsedEnv.data.NODE_ENV === "production") {
    validateProductionEnv(environment);
  }

  return parsedEnv.data;
}
