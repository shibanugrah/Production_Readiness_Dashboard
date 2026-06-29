import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const packageJson = JSON.parse(
  readFileSync(path.join(root, "package.json"), "utf8"),
) as { scripts: Record<string, string> };
const readme = readFileSync(path.join(root, "README.md"), "utf8");

describe("Prisma migration script contract", () => {
  it("keeps apply-only and interactive migration commands separate", () => {
    expect(packageJson.scripts["db:generate"]).toBe("prisma generate");
    expect(packageJson.scripts["db:migrate"]).toBe("prisma migrate deploy");
    expect(packageJson.scripts["db:migrate:dev"]).toBe("prisma migrate dev");
    expect(packageJson.scripts["db:migrate:status"]).toBe("prisma migrate status");
    expect(packageJson.scripts["db:production:status"]).toBe(
      "node scripts/run-production-db-command.mjs status",
    );
    expect(packageJson.scripts["db:production:migrate"]).toBe(
      "node scripts/run-production-db-command.mjs migrate",
    );
    expect(packageJson.scripts["db:production:seed"]).toBe(
      "node scripts/run-production-db-command.mjs seed",
    );
    expect(packageJson.scripts["deploy:check"]).toBe("tsx scripts/deploy-check.ts");
  });

  it("keeps deploy:check non-mutating and out of migration creation paths", () => {
    const deployCheckScript = packageJson.scripts["deploy:check"];
    const deployCheckSource = readFileSync(
      path.join(root, "scripts", "deploy-check.ts"),
      "utf8",
    );

    expect(deployCheckScript).not.toMatch(/migrate|seed|db push|reset/i);
    expect(deployCheckSource).not.toMatch(/execFileSync\(\s*["'](?:npx|prisma)/i);
    expect(deployCheckSource).not.toMatch(/execFileSync\([^)]*db:seed/i);
    expect(deployCheckSource).not.toMatch(/execFileSync\([^)]*migrate/i);
  });

  it("documents the checked-in migration workflow without db push", () => {
    expect(readme).toContain("npm run db:generate");
    expect(readme).toContain("npm run db:migrate");
    expect(readme).toContain("npm run db:migrate:status");
    expect(readme).toContain("npm run db:production:status");
    expect(readme).toContain("npm run db:production:migrate");
    expect(readme).toContain("npm run db:production:seed");
    expect(readme).toContain(
      "npm run db:migrate:dev -- --name descriptive_migration_name",
    );
    expect(readme).toContain("never use `prisma db push`");
  });
});
