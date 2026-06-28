import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function source(filePath: string) {
  return readFileSync(path.join(root, filePath), "utf8");
}

function listSourceFiles(directory: string): string[] {
  const absoluteDirectory = path.join(root, directory);
  const entries = readdirSync(absoluteDirectory);

  return entries.flatMap((entry) => {
    const absolutePath = path.join(absoluteDirectory, entry);
    const relativePath = path.relative(root, absolutePath);

    if (statSync(absolutePath).isDirectory()) {
      return listSourceFiles(relativePath);
    }

    return relativePath;
  });
}

describe("deployment readiness contracts", () => {
  it("excludes local and production env files from the Docker build context", () => {
    const dockerIgnore = source(".dockerignore");

    expect(dockerIgnore).toContain(".env");
    expect(dockerIgnore).toContain(".env.production");
    expect(dockerIgnore).toContain(".env*.local");
  });

  it("keeps the runtime Docker image on production defaults and non-root user", () => {
    const dockerfile = source("Dockerfile");
    const compose = source("docker-compose.yml");

    expect(dockerfile).toContain("ENV NODE_ENV=production");
    expect(dockerfile).toContain("ENV HOSTNAME=0.0.0.0");
    expect(dockerfile).toContain("USER node");
    expect(dockerfile).not.toContain("prisma migrate");
    expect(dockerfile).not.toContain("db:seed");
    expect(compose).toContain('HEALTH_CHECK_LOCAL_ALLOWLIST_ENABLED: "false"');
    expect(compose).toContain('DEMO_SERVICE_HEALTH_ENABLED: "false"');
  });

  it("does not introduce automatic migrate or seed behavior in application startup source", () => {
    const startupFiles = [
      "src/server/db.ts",
      "src/app/api/health/route.ts",
      "src/server/health.ts",
      ...listSourceFiles("src/app").filter((filePath) => filePath.endsWith("route.ts")),
    ];
    const combinedSource = startupFiles.map(source).join("\n");

    expect(combinedSource).not.toMatch(/prisma\s+migrate/i);
    expect(combinedSource).not.toMatch(/migrate\s+deploy/i);
    expect(combinedSource).not.toMatch(/db:seed|prisma\/seed/i);
  });

  it("documents production deployment without provider-specific infrastructure", () => {
    const runbook = source("docs/runbooks/production-deployment.md");

    expect(runbook).toContain("npm run db:migrate");
    expect(runbook).toContain("never `db:migrate:dev`");
    expect(runbook).toMatch(/do not use `prisma db push`/i);
    expect(runbook).toContain("n8n is not configured by default");
    expect(runbook).not.toMatch(/render\.com|railway|fly\.io|supabase|neon/i);
  });

  it("documents public demo scope without claiming future integrations are active", () => {
    const readme = source("README.md");
    const runbook = source("docs/runbooks/production-deployment.md");
    const combined = `${readme}\n${runbook}`;

    expect(combined).toContain(
      "Scheduled checks are intentionally not configured for this free public demo.",
    );
    expect(combined).toContain("Owner/Admin users can run manual health checks.");
    expect(combined).toContain(
      "Automated alerting, paging, and production notification delivery are not connected.",
    );
    expect(combined).toContain(
      "External integrations are future work and are not presented as active.",
    );
    expect(combined).not.toMatch(
      /n8n is active|paging is active|external integrations are active|OAuth is active|SSO is active|MFA is active|production alerting is active/i,
    );
  });
});
