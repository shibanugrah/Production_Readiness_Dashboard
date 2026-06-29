import { EventEmitter } from "node:events";
import { existsSync, readdirSync } from "node:fs";
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
    tmpdir?: string;
    spawnProcess?: SpawnProcess;
  },
) => Promise<number>;

type ProductionDbCommandModule = {
  buildExecutorCommand: (input: {
    repositoryRoot: string;
    subcommand: string;
    platform: string;
  }) => { command: string; args: string[] };
  parseSubcommand: (argv: string[]) => string;
  runProductionDbCommand: RunProductionDbCommand;
};

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

async function createLinkedRepo() {
  const repositoryRoot = await mkdtemp(
    path.join(os.tmpdir(), "production-db-wrapper-repo-"),
  );
  createdRoots.push(repositoryRoot);

  await mkdir(path.join(repositoryRoot, ".vercel"), { recursive: true });
  await writeFile(
    path.join(repositoryRoot, ".vercel", "project.json"),
    JSON.stringify({ projectId: "project_test", orgId: "team_test" }),
  );
  await writeFile(
    path.join(repositoryRoot, ".vercel", "repo.json"),
    JSON.stringify({ projects: [], remoteName: "origin" }),
  );
  await writeFile(
    path.join(repositoryRoot, ".vercel", ".env.production.local"),
    "DATABASE_URL=postgresql://should:not-copy@example.invalid/db",
  );
  await writeFile(
    path.join(repositoryRoot, ".env"),
    'DATABASE_URL="postgresql://local:local-password@localhost:5432/local?schema=public"',
  );

  return repositoryRoot;
}

async function createTempRoot() {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), "production-db-wrapper-temp-"),
  );
  createdRoots.push(tempRoot);

  return tempRoot;
}

function createSpawnProcess({
  exitCode = 0,
  stdout = "",
  stderr = "",
  onSpawn,
}: {
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  onSpawn?: (call: SpawnCall) => void;
}) {
  const calls: SpawnCall[] = [];
  const spawnProcess: SpawnProcess = (command, args, options) => {
    const call = { command, args: [...args], options };
    calls.push(call);
    onSpawn?.(call);

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
  it("supports only explicit subcommands and rejects unknown arguments", async () => {
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

  it("rejects write commands without the exact confirmation environment variable", async () => {
    for (const subcommand of ["migrate", "seed"]) {
      const repositoryRoot = await createLinkedRepo();
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

  it("runs Vercel from a clean temporary project directory", async () => {
    const repositoryRoot = await createLinkedRepo();
    const tempRoot = await createTempRoot();
    const { spawnProcess } = createSpawnProcess({
      onSpawn(call) {
        expect(call.options.cwd).not.toBe(repositoryRoot);
        expect(call.options.cwd.startsWith(tempRoot)).toBe(true);
        expect(readdirSync(call.options.cwd)).toEqual([".vercel"]);
        expect(readdirSync(path.join(call.options.cwd, ".vercel")).sort()).toEqual(
          ["project.json", "repo.json"],
        );
        expect(
          existsSync(path.join(call.options.cwd, ".vercel", ".env.production.local")),
        ).toBe(false);
        expect(existsSync(path.join(call.options.cwd, ".env"))).toBe(false);
        expect(existsSync(path.join(call.options.cwd, ".env.local"))).toBe(false);
      },
    });

    const result = await runCommand(["status"], {
      environment: {
        DATABASE_URL:
          "postgresql://local:local-password@localhost:5432/local?schema=public",
      },
      repositoryRoot,
      tmpdir: tempRoot,
      spawnProcess,
    });

    expect(result.exitCode).toBe(0);
  });

  it("constructs the production status command through npm prefix", async () => {
    const repositoryRoot = await createLinkedRepo();
    const { calls, spawnProcess } = createSpawnProcess({});

    await runCommand(["status"], {
      environment: {
        DATABASE_URL:
          "postgresql://local:local-password@localhost:5432/local?schema=public",
        AUTH_SECRET: "local-auth-secret",
        VERCEL_TOKEN: "vercel-token-for-cli",
      },
      platform: "linux",
      repositoryRoot,
      spawnProcess,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].command).toBe("npx");
    expect(calls[0].options.shell).toBe(false);
    expect(calls[0].args).toEqual([
      "--yes",
      "vercel",
      "env",
      "run",
      "-e",
      "production",
      "--",
      "npm",
      "--prefix",
      repositoryRoot,
      "run",
      "db:production:status",
      "--",
      "--execute",
    ]);
    expect(calls[0].options.env.DATABASE_URL).toBeUndefined();
    expect(calls[0].options.env.AUTH_SECRET).toBeUndefined();
    expect(calls[0].options.env.VERCEL_TOKEN).toBe("vercel-token-for-cli");
    expect(calls[0].options.env.PRODUCTION_DB_WRAPPER_EXECUTE).toBe("1");
    expect(calls[0].options.env.PRODUCTION_DB_WRAPPER_CLEAN_CWD).toBe(
      calls[0].options.cwd,
    );
  });

  it("uses npx.cmd on Windows", async () => {
    const repositoryRoot = await createLinkedRepo();
    const { calls, spawnProcess } = createSpawnProcess({});

    await runCommand(["status"], {
      environment: {},
      platform: "win32",
      repositoryRoot,
      spawnProcess,
    });

    expect(calls[0].command).toBe("npx.cmd");
    expect(calls[0].options.shell).toBe(true);
  });

  it("cleans up the temporary directory on success and failure", async () => {
    for (const exitCode of [0, 17]) {
      const repositoryRoot = await createLinkedRepo();
      const { calls, spawnProcess } = createSpawnProcess({ exitCode });
      const result = await runCommand(["status"], {
        environment: {},
        repositoryRoot,
        spawnProcess,
      });

      expect(result.exitCode).toBe(exitCode);
      expect(calls).toHaveLength(1);
      expect(existsSync(calls[0].options.cwd)).toBe(false);
    }
  });

  it("runs the internal Prisma executor from the clean working directory", async () => {
    const repositoryRoot = await createLinkedRepo();
    const cleanWorkingDirectory = await createTempRoot();
    const { calls, spawnProcess } = createSpawnProcess({});
    const result = await runCommand(["status", "--execute"], {
      environment: {
        PRODUCTION_DB_WRAPPER_EXECUTE: "1",
        PRODUCTION_DB_WRAPPER_CLEAN_CWD: cleanWorkingDirectory,
        DATABASE_URL:
          "postgresql://remote:remote-password@db.example.invalid:5432/prod?schema=public",
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
      path.join(repositoryRoot, "prisma", "schema.prisma"),
    ]);
    expect(calls[0].options.cwd).toBe(cleanWorkingDirectory);
    expect(calls[0].options.env.DATABASE_URL).toBe(
      "postgresql://remote:remote-password@db.example.invalid:5432/prod?schema=public",
    );
  });

  it("refuses direct internal executor use without the wrapper marker", async () => {
    const repositoryRoot = await createLinkedRepo();
    const { calls, spawnProcess } = createSpawnProcess({});
    const result = await runCommand(["status", "--execute"], {
      environment: {},
      repositoryRoot,
      spawnProcess,
    });

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain(
      "Refusing to run the internal production database executor directly.",
    );
    expect(calls).toHaveLength(0);
  });

  it("redacts secret-looking values from child output and wrapper errors", async () => {
    const repositoryRoot = await createLinkedRepo();
    const { spawnProcess } = createSpawnProcess({
      stdout:
        'DATABASE_URL="postgresql://prod_user:prod-password@db.example.invalid:5432/prod?schema=public"\n',
      stderr: 'AUTH_SECRET="prod-auth-secret"\nAPI_TOKEN: prod-token-value\n',
    });
    const result = await runCommand(["status"], {
      environment: {
        DATABASE_URL:
          "postgresql://local:local-password@localhost:5432/local?schema=public",
        AUTH_SECRET: "local-auth-secret",
      },
      repositoryRoot,
      spawnProcess,
    });
    const combinedOutput = `${result.stdout}\n${result.stderr}`;

    expect(combinedOutput).toContain("[redacted]");
    expect(combinedOutput).not.toContain("prod-password");
    expect(combinedOutput).not.toContain("prod-auth-secret");
    expect(combinedOutput).not.toContain("prod-token-value");
    expect(combinedOutput).not.toContain("local-password");
    expect(combinedOutput).not.toContain("local-auth-secret");
  });
});
