#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SUPPORTED_COMMANDS = {
  status: "db:migrate:status",
  migrate: "db:migrate",
  seed: "db:seed",
};

const WRITE_COMMANDS = new Set(["migrate", "seed"]);

const LOCAL_APP_ENV_KEYS = new Set([
  "DATABASE_URL",
  "AUTH_SECRET",
  "INTERNAL_HEALTH_CHECK_SECRET",
  "NODE_ENV",
  "APP_VERSION",
  "HEALTH_CHECK_LOCAL_ALLOWLIST_ENABLED",
  "HEALTH_CHECK_LOCAL_ALLOWED_TARGETS",
  "DEMO_SERVICE_HEALTH_ENABLED",
  "PUBLIC_DEMO_ACCESS_ENABLED",
  "PUBLIC_DEMO_APP_BASE_URL",
  "PUBLIC_DEMO_VIEWER_EMAIL",
  "PUBLIC_DEMO_OWNER_EMAIL",
  "PUBLIC_DEMO_OWNER_PASSWORD",
  "DEMO_OWNER_EMAIL",
  "DEMO_OWNER_PASSWORD",
  "DEMO_ADMIN_EMAIL",
  "DEMO_ADMIN_PASSWORD",
  "DEMO_VIEWER_EMAIL",
  "DEMO_VIEWER_PASSWORD",
  "CONFIRM_PRODUCTION_DB_WRITE",
]);

const OPTIONAL_VERCEL_METADATA_FILES = ["repo.json"];
const EXECUTE_FLAG = "--execute";
const EXECUTE_ENV_KEY = "PRODUCTION_DB_WRAPPER_EXECUTE";
const EXECUTE_CWD_ENV_KEY = "PRODUCTION_DB_WRAPPER_CLEAN_CWD";
const EXECUTE_WRITE_ENV_KEY = "PRODUCTION_DB_WRAPPER_WRITE_CONFIRMED";

class CliError extends Error {
  constructor(message, exitCode = 1) {
    super(message);
    this.name = "CliError";
    this.exitCode = exitCode;
  }
}

function usage() {
  return [
    "Usage: node scripts/run-production-db-command.mjs <status|migrate|seed>",
    "",
    "Only status is read-only. migrate and seed require CONFIRM_PRODUCTION_DB_WRITE=YES.",
  ].join("\n");
}

export function parseSubcommand(argv) {
  if (argv.length !== 1) {
    throw new CliError(usage(), 2);
  }

  const [subcommand] = argv;

  if (!Object.hasOwn(SUPPORTED_COMMANDS, subcommand)) {
    throw new CliError(usage(), 2);
  }

  return subcommand;
}

export function getRepositoryRoot(scriptUrl = import.meta.url) {
  return path.resolve(path.dirname(fileURLToPath(scriptUrl)), "..");
}

export function getNpxCommand(platform = process.platform) {
  return platform === "win32" ? "npx.cmd" : "npx";
}

export function buildChildEnvironment(environment = process.env) {
  const childEnvironment = { ...environment };

  for (const key of LOCAL_APP_ENV_KEYS) {
    delete childEnvironment[key];
  }

  return childEnvironment;
}

export function buildVercelArgs({ repositoryRoot, subcommand }) {
  return [
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
    `db:production:${subcommand}`,
    "--",
    EXECUTE_FLAG,
  ];
}

function getLocalBinary(repositoryRoot, binaryName, platform) {
  return path.join(
    repositoryRoot,
    "node_modules",
    ".bin",
    platform === "win32" ? `${binaryName}.cmd` : binaryName,
  );
}

export function buildExecutorCommand({ repositoryRoot, subcommand, platform }) {
  const schemaPath = path.join(repositoryRoot, "prisma", "schema.prisma");

  if (subcommand === "seed") {
    return {
      command: getLocalBinary(repositoryRoot, "tsx", platform),
      args: [path.join(repositoryRoot, "prisma", "seed.ts")],
    };
  }

  return {
    command: getLocalBinary(repositoryRoot, "prisma", platform),
    args:
      subcommand === "status"
        ? ["migrate", "status", "--schema", schemaPath]
        : ["migrate", "deploy", "--schema", schemaPath],
  };
}

export function redactSensitiveOutput(value) {
  return String(value)
    .replace(
      /\b(postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s"'<>`]+/gi,
      "$1://[redacted]",
    )
    .replace(/(https?:\/\/)[^/\s:@]+:[^@\s/]+@/gi, "$1[redacted]@")
    .replace(
      /\b([A-Z0-9_]*(?:DATABASE_URL|PASSWORD|PASS|SECRET|TOKEN|CREDENTIAL|CONNECTION_STRING)[A-Z0-9_]*)\s*=\s*("[^"]*"|'[^']*'|[^\s\r\n]+)/gi,
      "$1=[redacted]",
    )
    .replace(
      /\b([A-Z0-9_]*(?:DATABASE_URL|PASSWORD|PASS|SECRET|TOKEN|CREDENTIAL|CONNECTION_STRING)[A-Z0-9_]*)\s*:\s*([^\r\n]+)/gi,
      "$1: [redacted]",
    );
}

function writeSafe(stream, chunk) {
  stream.write(redactSensitiveOutput(chunk));
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function removeTemporaryDirectory(fs, directory) {
  const retryableCodes = new Set(["EBUSY", "ENOTEMPTY", "EPERM"]);

  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      await fs.rm(directory, { recursive: true, force: true });
      return;
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        retryableCodes.has(String(error.code)) &&
        attempt < 19
      ) {
        await wait(250);
        continue;
      }

      throw error;
    }
  }
}

function waitForChild(childProcess, stdout, stderr) {
  return new Promise((resolve) => {
    childProcess.stdout?.on("data", (chunk) => writeSafe(stdout, chunk));
    childProcess.stderr?.on("data", (chunk) => writeSafe(stderr, chunk));

    childProcess.on("error", (error) => {
      writeSafe(stderr, `Failed to start Vercel production database command: ${error.message}\n`);
      resolve(1);
    });

    childProcess.on("close", (code, signal) => {
      if (typeof code === "number") {
        resolve(code);
        return;
      }

      writeSafe(
        stderr,
        `Vercel production database command exited after signal ${signal ?? "unknown"}.\n`,
      );
      resolve(1);
    });
  });
}

export async function runProductionDbCommand(argv, options = {}) {
  const {
    environment = process.env,
    platform = process.platform,
    repositoryRoot = getRepositoryRoot(),
    stdout = process.stdout,
    stderr = process.stderr,
    tmpdir = os.tmpdir(),
    fs = { existsSync, copyFile, mkdir, mkdtemp, rm },
    spawnProcess = spawn,
  } = options;

  if (argv.length === 2 && argv[1] === EXECUTE_FLAG) {
    return executeProductionDbCommand([argv[0]], options);
  }

  let tempDirectory;

  try {
    const subcommand = parseSubcommand(argv);

    if (
      WRITE_COMMANDS.has(subcommand) &&
      environment.CONFIRM_PRODUCTION_DB_WRITE !== "YES"
    ) {
      throw new CliError(
        `Refusing to run production ${subcommand}. Set CONFIRM_PRODUCTION_DB_WRITE=YES in the environment to allow this write command.`,
        1,
      );
    }

    const projectJsonPath = path.join(repositoryRoot, ".vercel", "project.json");

    if (!fs.existsSync(projectJsonPath)) {
      throw new CliError(
        "Missing .vercel/project.json. Link this checkout to the Vercel project before running production database commands.",
        1,
      );
    }

    tempDirectory = await fs.mkdtemp(
      path.join(tmpdir, "production-readiness-vercel-db-"),
    );
    const tempVercelDirectory = path.join(tempDirectory, ".vercel");

    await fs.mkdir(tempVercelDirectory, { recursive: true });
    await fs.copyFile(
      projectJsonPath,
      path.join(tempVercelDirectory, "project.json"),
    );

    for (const metadataFile of OPTIONAL_VERCEL_METADATA_FILES) {
      const metadataPath = path.join(repositoryRoot, ".vercel", metadataFile);

      if (fs.existsSync(metadataPath)) {
        await fs.copyFile(
          metadataPath,
          path.join(tempVercelDirectory, metadataFile),
        );
      }
    }

    writeSafe(
      stdout,
      `Running production database ${subcommand} through Vercel from an isolated temporary working directory.\n`,
    );

    const command = getNpxCommand(platform);
    const args = buildVercelArgs({ repositoryRoot, subcommand });
    const childEnvironment = buildChildEnvironment(environment);

    childEnvironment[EXECUTE_ENV_KEY] = "1";
    childEnvironment[EXECUTE_CWD_ENV_KEY] = tempDirectory;

    if (WRITE_COMMANDS.has(subcommand)) {
      childEnvironment[EXECUTE_WRITE_ENV_KEY] = "YES";
    }

    const childProcess = spawnProcess(command, args, {
      cwd: tempDirectory,
      env: childEnvironment,
      shell: platform === "win32",
      windowsHide: true,
    });

    return await waitForChild(childProcess, stdout, stderr);
  } catch (error) {
    if (error instanceof CliError) {
      writeSafe(stderr, `${error.message}\n`);
      return error.exitCode;
    }

    if (error instanceof Error) {
      writeSafe(stderr, `${error.message}\n`);
      return 1;
    }

    writeSafe(stderr, "Unknown production database command failure.\n");
    return 1;
  } finally {
    if (tempDirectory) {
      try {
        await removeTemporaryDirectory(fs, tempDirectory);
      } catch {
        writeSafe(
          stderr,
          "Failed to remove the temporary Vercel working directory after the command completed.\n",
        );
      }
    }
  }
}

async function executeProductionDbCommand(argv, options = {}) {
  const {
    environment = process.env,
    platform = process.platform,
    repositoryRoot = getRepositoryRoot(),
    stdout = process.stdout,
    stderr = process.stderr,
    spawnProcess = spawn,
  } = options;

  try {
    const subcommand = parseSubcommand(argv);

    if (environment[EXECUTE_ENV_KEY] !== "1") {
      throw new CliError(
        "Refusing to run the internal production database executor directly.",
        2,
      );
    }

    if (
      WRITE_COMMANDS.has(subcommand) &&
      environment[EXECUTE_WRITE_ENV_KEY] !== "YES"
    ) {
      throw new CliError(
        `Refusing to run production ${subcommand}. Set CONFIRM_PRODUCTION_DB_WRITE=YES in the environment before invoking the production wrapper.`,
        1,
      );
    }

    const cleanWorkingDirectory = environment[EXECUTE_CWD_ENV_KEY];

    if (!cleanWorkingDirectory) {
      throw new CliError(
        "Missing isolated production database working directory.",
        1,
      );
    }

    const { command, args } = buildExecutorCommand({
      repositoryRoot,
      subcommand,
      platform,
    });
    const childProcess = spawnProcess(command, args, {
      cwd: cleanWorkingDirectory,
      env: environment,
      shell: platform === "win32",
      windowsHide: true,
    });

    return await waitForChild(childProcess, stdout, stderr);
  } catch (error) {
    if (error instanceof CliError) {
      writeSafe(stderr, `${error.message}\n`);
      return error.exitCode;
    }

    if (error instanceof Error) {
      writeSafe(stderr, `${error.message}\n`);
      return 1;
    }

    writeSafe(stderr, "Unknown production database executor failure.\n");
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const exitCode = await runProductionDbCommand(process.argv.slice(2));
  process.exitCode = exitCode;
}
