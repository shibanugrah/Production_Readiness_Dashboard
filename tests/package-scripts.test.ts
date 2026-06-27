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
  });

  it("documents the checked-in migration workflow without db push", () => {
    expect(readme).toContain("npm run db:generate");
    expect(readme).toContain("npm run db:migrate");
    expect(readme).toContain("npm run db:migrate:status");
    expect(readme).toContain(
      "npm run db:migrate:dev -- --name descriptive_migration_name",
    );
    expect(readme).toContain("never use `prisma db push`");
  });
});
