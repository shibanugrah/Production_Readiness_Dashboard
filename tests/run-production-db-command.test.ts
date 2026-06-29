import { EventEmitter } from "node:events";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

const root = process.cwd();
const createdRoots: string[] = [];

type TestEnvironment = Record<string, string | undefined>;

type SpawnOptions = {
  cwd: string;
  env: TestEnvironment;
  shell: boolean;
  windowsHide: true;
};

type SpawnCall = {
  command: string;
  args: string[];
  options: SpawnOptions;
};

type FakeChildProcess = EventEmitter & {
  stdout: EventEmitter;
  stderr: EventEmitter;
};

type SpawnProcess = (
  command: string,
  args: string[],
  options: SpawnOptions,
) => FakeChildProcess;

type RunProductionDbCommand = (
  argv: string[],
  options: {
    environment?: TestEnvironment;
    platform?: string;
    repositoryRoot?: string;
    stdout?: NodeJS.WritableStream;
    stderr?: NodeJS.WritableStream;
    spawnProcess?: SpawnProcess;
  },
) => Promise<number>;

type ProductionDbCommandModule = {
  buildCommand: (input: {
    repositoryRoot: string;
    subcommand: string;
    platform: string;
  }) => { command: string; args: string[] };
  parseSubcommand: (argv: string[]) => string;
  runProductionDbCommand: RunProductionDbCommand;
  validateProductionDatabaseUrl: (databaseUrl: string) => void;
};

const productionDatabaseUrl =
  "postgresql://prod_user:prod_password@database.example.invalid:5432/prod?schema=public";

async function loadCommandModule() {
  return (await import(
    pathToFileURL(path.join(root, "scripts", "run-production-db-command.mjs"))
      .href
  )) as ProductionDbCommandModule;
}

function createMemoryStream() {
  let output = "";

  return {
    stream: {
      write(chunk: string | Uint8Array) {
        output += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
        return true;
      },
    } as NodeJS.WritableStream,
    output: () => output,
  };
}

async function createRepo({
  productionUrl = productionDatabaseUrl,
}: {
  productionUrl?: string;
} = {}) {
  const repositoryRoot = await mkdtemp(
    path.join(os.tmpdir(), "production-db-wrapper-repo-"),
  );
  createdRoots.push(repositoryRoot);

  await mkdir(path.join(repositoryRoot, ".private"), { recursive: true });
  await mkdir(path.join(repositoryRoot, "prisma"), { recursive: true });
  await mkdir(path.join(repositoryRoot, "node_modules", ".bin"), {
    recursive: true,
  });
  await writeFile(
    path.join(repositoryRoot, ".private", "production-db.env"),
    `DATABASE_URL="${productionUrl}"\n`,
  );
  await writeFile(
    path.join(repositoryRoot, ".env"),
    'DATABASE_URL="postgresql://local:local-password@localhost:5432/local?schema=public"\n',
  );
  await writeFile(path.join(repositoryRoot, "prisma", "schema.prisma"), "");

  return repositoryRoot;
}

function createSpawnProcess({
  exitCode = 0,
  stdout = "",
  stderr = "",
}: {
  exitCode?: number;
  stdout?: string;
  stderr?: string;
}) {
  const calls: SpawnCall[] = [];
  const spawnProcess: SpawnProcess = (command, args, options) => {
    calls.push({ command, args: [...args], options });

    const child = new EventEmitter() as FakeChildProcess;
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();

    queueMicrotask(() => {
      if (stdout) {
        child.stdout.emit("data", stdout);
      }

      if (stderr) {
        child.stderr.emit("data", stderr);
      }

      child.emit("close", exitCode, null);
    });

    return child;
  };

  return { calls, spawnProcess };
}

async function runCommand(
  argv: string[],
  options: Parameters<RunProductionDbCommand>[1],
) {
  const commandModule = await loadCommandModule();
  const stdout = createMemoryStream();
  const stderr = createMemoryStream();
  const exitCode = await commandModule.runProductionDbCommand(argv, {
    stdout: stdout.stream,
    stderr: stderr.stream,
    ...options,
  });

  return {
    exitCode,
    stdout: stdout.output(),
    stderr: stderr.output(),
  };
}

afterEach(async () => {
  await Promise.all(
    createdRoots.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("production database command wrapper", () => {
  it("constructs the valid read-only status command", async () => {
    const repositoryRoot = await createRepo();
    const { calls, spawnProcess } = createSpawnProcess({});
    const result = await runCommand(["status"], {
      environment: {
        DATABASE_URL:
          "postgresql://local:local-password@localhost:5432/local?schema=public",
        NODE_ENV: "development",
      },
      platform: "linux",
      repositoryRoot,
      spawnProcess,
    });

    expect(result.exitCode).toBe(0);
    expect(calls).toHaveLength(1);
    expect(calls[0].command).toBe(
      path.join(repositoryRoot, "node_modules", ".bin", "prisma"),
    );
    expect(calls[0].args).toEqual([
      "migrate",
      "status",
      "--schema",
      path.join("prisma", "schema.prisma"),
    ]);
    expect(calls[0].options.cwd).toBe(repositoryRoot);
    expect(calls[0].options.env.DATABASE_URL).toBe(productionDatabaseUrl);
    expect(calls[0].options.env.NODE_ENV).toBe("production");
  });

  it("rejects invalid subcommands and extra arguments", async () => {
    const commandModule = await loadCommandModule();

    expect(commandModule.parseSubcommand(["status"])).toBe("status");
    expect(commandModule.parseSubcommand(["migrate"])).toBe("migrate");
    expect(commandModule.parseSubcommand(["seed"])).toBe("seed");
    expect(() => commandModule.parseSubcommand(["deploy"])).toThrow(/Usage:/);
    expect(() => commandModule.parseSubcommand(["status", "--verbose"])).toThrow(
      /Usage:/,
    );
    expect(() =>
      commandModule.parseSubcommand(["migrate", "CONFIRM_PRODUCTION_DB_WRITE=YES"]),
    ).toThrow(/Usage:/);
  });

  it("refuses when the private production env file is missing", async () => {
    const repositoryRoot = await mkdtemp(
      path.join(os.tmpdir(), "production-db-wrapper-repo-"),
    );
    createdRoots.push(repositoryRoot);
    const { calls, spawnProcess } = createSpawnProcess({});
    const result = await runCommand(["status"], {
      repositoryRoot,
      spawnProcess,
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Missing .private/production-db.env");
    expect(calls).toHaveLength(0);
  });

  it("refuses empty production database URLs", async () => {
    const repositoryRoot = await createRepo({ productionUrl: "" });
    const { calls, spawnProcess } = createSpawnProcess({});
    const result = await runCommand(["status"], {
      repositoryRoot,
      spawnProcess,
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("DATABASE_URL is empty");
    expect(calls).toHaveLength(0);
  });

  it("refuses local Docker and private-network production database URLs", async () => {
    const commandModule = await loadCommandModule();

    for (const url of [
      "postgresql://postgres:postgres@localhost:5432/app",
      "postgresql://postgres:postgres@127.0.0.1:5432/app",
      "postgresql://postgres:postgres@[::1]:5432/app",
      "postgresql://postgres:postgres@postgres:5432/app",
      "postgresql://postgres:postgres@db:5432/app",
      "postgresql://postgres:postgres@app:5432/app",
      "postgresql://postgres:postgres@10.0.0.4:5432/app",
      "postgresql://postgres:postgres@172.16.0.4:5432/app",
      "postgresql://postgres:postgres@192.168.1.4:5432/app",
    ]) {
      expect(() => commandModule.validateProductionDatabaseUrl(url)).toThrow(
        /external production PostgreSQL host/,
      );
    }
  });

  it("refuses write commands without the exact confirmation variable", async () => {
    for (const subcommand of ["migrate", "seed"]) {
      const repositoryRoot = await createRepo();
      const { calls, spawnProcess } = createSpawnProcess({});
      const result = await runCommand([subcommand], {
        environment: {},
        repositoryRoot,
        spawnProcess,
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain(
        `Refusing to run production ${subcommand}.`,
      );
      expect(calls).toHaveLength(0);
    }
  });

  it("constructs write commands only when confirmation is present", async () => {
    const repositoryRoot = await createRepo();
    const { calls, spawnProcess } = createSpawnProcess({});
    const migrateResult = await runCommand(["migrate"], {
      environment: { CONFIRM_PRODUCTION_DB_WRITE: "YES" },
      platform: "linux",
      repositoryRoot,
      spawnProcess,
    });
    const seedResult = await runCommand(["seed"], {
      environment: { CONFIRM_PRODUCTION_DB_WRITE: "YES" },
      platform: "linux",
      repositoryRoot,
      spawnProcess,
    });

    expect(migrateResult.exitCode).toBe(0);
    expect(seedResult.exitCode).toBe(0);
    expect(calls[0].args).toEqual([
      "migrate",
      "deploy",
      "--schema",
      path.join("prisma", "schema.prisma"),
    ]);
    expect(calls[1].command).toBe(
      path.join(repositoryRoot, "node_modules", ".bin", "tsx"),
    );
    expect(calls[1].args).toEqual([path.join("prisma", "seed.ts")]);
  });

  it("ensures root .env cannot override the production child DATABASE_URL", async () => {
    const repositoryRoot = await createRepo();
    const { calls, spawnProcess } = createSpawnProcess({});

    await runCommand(["status"], {
      environment: {
        DATABASE_URL:
          "postgresql://local:local-password@localhost:5432/local?schema=public",
      },
      repositoryRoot,
      spawnProcess,
    });

    expect(calls[0].options.env.DATABASE_URL).toBe(productionDatabaseUrl);
    expect(calls[0].options.env.DATABASE_URL).not.toContain("localhost");
  });

  it("redacts secret values from wrapper output", async () => {
    const repositoryRoot = await createRepo();
    const productionHost = new URL(productionDatabaseUrl).hostname;
    const { spawnProcess } = createSpawnProcess({
      stdout: `connected to ${productionDatabaseUrl}\nDatasource host ${productionHost}\n`,
      stderr: `DATABASE_URL=${productionDatabaseUrl}\n`,
    });
    const result = await runCommand(["status"], {
      environment: {},
      repositoryRoot,
      spawnProcess,
    });
    const combinedOutput = `${result.stdout}\n${result.stderr}`;

    expect(combinedOutput).toContain("[redacted]");
    expect(combinedOutput).not.toContain(productionDatabaseUrl);
    expect(combinedOutput).not.toContain(productionHost);
    expect(combinedOutput).not.toContain("prod_password");
  });

  it("returns child-process command failures", async () => {
    const repositoryRoot = await createRepo();
    const { spawnProcess } = createSpawnProcess({ exitCode: 17 });
    const result = await runCommand(["status"], {
      repositoryRoot,
      spawnProcess,
    });

    expect(result.exitCode).toBe(17);
  });

  it("does not use Vercel CLI or dotenv-cli", async () => {
    const commandModule = await loadCommandModule();
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(path.join(root, "scripts", "run-production-db-command.mjs"), "utf8"),
    );

    expect(source).not.toMatch(/\bvercel\b/i);
    expect(source).not.toMatch(/dotenv-cli/i);
    expect(
      commandModule.buildCommand({
        repositoryRoot: root,
        subcommand: "status",
        platform: "linux",
      }).command,
    ).toContain(path.join("node_modules", ".bin", "prisma"));
  });
});
