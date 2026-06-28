import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { validateEnv } from "../src/env";

const root = process.cwd();
const safeValidationFixture = {
  DATABASE_URL:
    "postgresql://deploy_check_user:deploy_check_password@db.example.invalid:5432/production_readiness_dashboard?schema=public",
  AUTH_SECRET: "deploy-check-auth-value-0123456789abcdef",
  INTERNAL_HEALTH_CHECK_SECRET: "deploy-check-internal-value-0123456789",
  NODE_ENV: "production",
  APP_VERSION: "deploy-check",
  HEALTH_CHECK_LOCAL_ALLOWLIST_ENABLED: "false",
  HEALTH_CHECK_LOCAL_ALLOWED_TARGETS: "",
  DEMO_SERVICE_HEALTH_ENABLED: "false",
  PUBLIC_DEMO_ACCESS_ENABLED: "false",
} as NodeJS.ProcessEnv;

function log(message: string) {
  process.stdout.write(`${message}\n`);
}

function fail(message: string): never {
  process.stderr.write(`deploy:check failed: ${message}\n`);
  process.exit(1);
}

function usesExplicitDeploymentEnvironment(environment: NodeJS.ProcessEnv) {
  return [
    "DATABASE_URL",
    "AUTH_SECRET",
    "INTERNAL_HEALTH_CHECK_SECRET",
    "APP_VERSION",
    "HEALTH_CHECK_LOCAL_ALLOWLIST_ENABLED",
    "HEALTH_CHECK_LOCAL_ALLOWED_TARGETS",
    "DEMO_SERVICE_HEALTH_ENABLED",
    "PUBLIC_DEMO_ACCESS_ENABLED",
    "PUBLIC_DEMO_APP_BASE_URL",
    "PUBLIC_DEMO_VIEWER_EMAIL",
  ].some((key) => Boolean(environment[key])) || environment.NODE_ENV === "production";
}

function assertProductionEnvironment() {
  const environment: NodeJS.ProcessEnv = usesExplicitDeploymentEnvironment(process.env)
    ? ({ ...process.env, NODE_ENV: "production" } as NodeJS.ProcessEnv)
    : safeValidationFixture;

  validateEnv(environment);

  if (environment === safeValidationFixture) {
    log("Validated production rules with a built-in non-secret fixture.");
    log("Provide real deployment environment variables to validate a target deployment.");
  } else {
    log("Validated provided production environment variables without printing values.");
  }
}

function assertPrismaArtifacts() {
  const schemaPath = path.join(root, "prisma", "schema.prisma");
  const generatedClientPath = path.join(root, "node_modules", ".prisma", "client", "index.js");

  if (!existsSync(schemaPath)) {
    fail("Prisma schema is missing at prisma/schema.prisma.");
  }

  if (!existsSync(generatedClientPath)) {
    fail("Prisma client is not generated. Run npm run db:generate first.");
  }

  log("Confirmed Prisma schema and generated client are available.");
}

function assertMigrationScripts() {
  const packageJson = JSON.parse(
    readFileSync(path.join(root, "package.json"), "utf8"),
  ) as { scripts?: Record<string, string> };
  const scripts = packageJson.scripts ?? {};

  if (scripts["db:migrate"] !== "prisma migrate deploy") {
    fail("db:migrate must use prisma migrate deploy for apply-only migrations.");
  }

  if (scripts["db:migrate:dev"] !== "prisma migrate dev") {
    fail("db:migrate:dev must remain the explicit interactive migration command.");
  }

  for (const [name, command] of Object.entries(scripts)) {
    if (
      name !== "db:migrate:dev" &&
      /prisma\s+migrate\s+dev|prisma\s+db\s+push|prisma\s+migrate\s+reset/.test(command)
    ) {
      fail(`${name} invokes a development or destructive Prisma command.`);
    }
  }

  log("Confirmed migration scripts use apply-only deployment behavior.");
}

function assertDockerBuild() {
  log("Building Docker production image for deploy readiness...");
  execFileSync(
    "docker",
    [
      "build",
      "--target",
      "runner",
      "--tag",
      "production-readiness-dashboard:deploy-check",
      ".",
    ],
    { cwd: root, stdio: "inherit" },
  );
  log("Confirmed Docker production image builds.");
}

try {
  assertProductionEnvironment();
  assertPrismaArtifacts();
  assertMigrationScripts();
  assertDockerBuild();
  log("deploy:check completed successfully.");
} catch (error) {
  if (error instanceof Error) {
    fail(error.message);
  }

  fail("Unknown deployment readiness failure.");
}
