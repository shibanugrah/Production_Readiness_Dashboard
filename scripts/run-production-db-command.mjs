#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PRODUCTION_ENV_PATH = ".private/production-db.env";
const WRITE_COMMANDS = new Set(["migrate", "seed"]);
const SUPPORTED_COMMANDS = new Set(["status", "migrate", "seed"]);

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

  if (!SUPPORTED_COMMANDS.has(subcommand)) {
    throw new CliError(usage(), 2);
  }

  return subcommand;
}

export function getRepositoryRoot(scriptUrl = import.meta.url) {
  return path.resolve(path.dirname(fileURLToPath(scriptUrl)), "..");
}

function unquote(value) {
  const trimmed = value.trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

export function parseProductionEnvFile(contents) {
  const values = new Map();

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);

    if (!match) {
      throw new CliError(
        `${PRODUCTION_ENV_PATH} contains an invalid environment line.`,
        1,
      );
    }

    values.set(match[1], unquote(match[2]));
  }

  const keys = [...values.keys()];

  if (keys.length !== 1 || keys[0] !== "DATABASE_URL") {
    throw new CliError(
      `${PRODUCTION_ENV_PATH} must contain only DATABASE_URL.`,
      1,
    );
  }

  return values.get("DATABASE_URL") ?? "";
}

function isPrivateIpAddress(hostname) {
  const normalizedHost = hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (net.isIP(normalizedHost) === 4) {
    const [first, second] = normalizedHost.split(".").map(Number);

    return (
      first === 10 ||
      first === 127 ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      (first === 169 && second === 254)
    );
  }

  if (net.isIP(normalizedHost) === 6) {
    return (
      normalizedHost === "::1" ||
      normalizedHost.startsWith("fc") ||
      normalizedHost.startsWith("fd") ||
      normalizedHost.startsWith("fe80")
    );
  }

  return false;
}

export function validateProductionDatabaseUrl(databaseUrl) {
  if (!databaseUrl.trim()) {
    throw new CliError(`${PRODUCTION_ENV_PATH} DATABASE_URL is empty.`, 1);
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    throw new CliError(
      `${PRODUCTION_ENV_PATH} DATABASE_URL must be a valid PostgreSQL URL.`,
      1,
    );
  }

  if (parsedUrl.protocol !== "postgresql:" && parsedUrl.protocol !== "postgres:") {
    throw new CliError(
      `${PRODUCTION_ENV_PATH} DATABASE_URL must be a PostgreSQL URL.`,
      1,
    );
  }

  const hostname = parsedUrl.hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (
    ["localhost", "127.0.0.1", "::1", "postgres", "db", "app"].includes(
      hostname,
    ) ||
    isPrivateIpAddress(hostname)
  ) {
    throw new CliError(
      `${PRODUCTION_ENV_PATH} DATABASE_URL must point to an external production PostgreSQL host.`,
      1,
    );
  }
}

export function readProductionDatabaseUrl({
  repositoryRoot = getRepositoryRoot(),
  fs = { existsSync, readFileSync },
} = {}) {
  const productionEnvPath = path.join(repositoryRoot, PRODUCTION_ENV_PATH);

  if (!fs.existsSync(productionEnvPath)) {
    throw new CliError(
      `Missing ${PRODUCTION_ENV_PATH}. Create it locally with only DATABASE_URL before running production database commands.`,
      1,
    );
  }

  const databaseUrl = parseProductionEnvFile(
    fs.readFileSync(productionEnvPath, "utf8"),
  );

  validateProductionDatabaseUrl(databaseUrl);

  return databaseUrl;
}

function getLocalBinary(repositoryRoot, binaryName, platform) {
  return path.join(
    repositoryRoot,
    "node_modules",
    ".bin",
    platform === "win32" ? `${binaryName}.cmd` : binaryName,
  );
}

export function buildCommand({ repositoryRoot, subcommand, platform }) {
  const schemaPath = path.join("prisma", "schema.prisma");

  if (subcommand === "seed") {
    return {
      command: getLocalBinary(repositoryRoot, "tsx", platform),
      args: [path.join("prisma", "seed.ts")],
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

export function buildChildEnvironment(environment, databaseUrl) {
  return {
    ...environment,
    DATABASE_URL: databaseUrl,
    NODE_ENV: "production",
  };
}

export function getDatabaseUrlSecrets(databaseUrl) {
  const secrets = [databaseUrl];

  try {
    const parsedUrl = new URL(databaseUrl);

    for (const value of [
      parsedUrl.hostname,
      decodeURIComponent(parsedUrl.username),
      decodeURIComponent(parsedUrl.password),
    ]) {
      if (value) {
        secrets.push(value);
      }
    }
  } catch {
    // Validation catches malformed URLs before command execution.
  }

  return secrets;
}

export function redactSensitiveOutput(value, secrets = []) {
  let output = String(value);

  for (const secret of secrets) {
    if (secret) {
      output = output.split(secret).join("[redacted]");
    }
  }

  return output
    .replace(
      /\b(postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s"'<>`]+/gi,
      "$1://[redacted]",
    )
    .replace(
      /\b([A-Z0-9_]*(?:DATABASE_URL|PASSWORD|PASS|SECRET|TOKEN|CREDENTIAL|CONNECTION_STRING)[A-Z0-9_]*)\s*=\s*("[^"]*"|'[^']*'|[^\s\r\n]+)/gi,
      "$1=[redacted]",
    )
    .replace(
      /\b([A-Z0-9_]*(?:DATABASE_URL|PASSWORD|PASS|SECRET|TOKEN|CREDENTIAL|CONNECTION_STRING)[A-Z0-9_]*)\s*:\s*([^\r\n]+)/gi,
      "$1: [redacted]",
    );
}

function writeSafe(stream, chunk, secrets) {
  stream.write(redactSensitiveOutput(chunk, secrets));
}

function waitForChild(childProcess, stdout, stderr, secrets) {
  return new Promise((resolve) => {
    childProcess.stdout?.on("data", (chunk) => writeSafe(stdout, chunk, secrets));
    childProcess.stderr?.on("data", (chunk) => writeSafe(stderr, chunk, secrets));

    childProcess.on("error", (error) => {
      writeSafe(
        stderr,
        `Failed to start production database command: ${error.message}\n`,
        secrets,
      );
      resolve(1);
    });

    childProcess.on("close", (code, signal) => {
      if (typeof code === "number") {
        resolve(code);
        return;
      }

      writeSafe(
        stderr,
        `Production database command exited after signal ${signal ?? "unknown"}.\n`,
        secrets,
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
    fs = { existsSync, readFileSync },
    spawnProcess = spawn,
  } = options;

  let databaseUrl = "";

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

    databaseUrl = readProductionDatabaseUrl({ repositoryRoot, fs });

    const { command, args } = buildCommand({
      repositoryRoot,
      subcommand,
      platform,
    });
    const childProcess = spawnProcess(command, args, {
      cwd: repositoryRoot,
      env: buildChildEnvironment(environment, databaseUrl),
      shell: platform === "win32",
      windowsHide: true,
    });

    return await waitForChild(
      childProcess,
      stdout,
      stderr,
      getDatabaseUrlSecrets(databaseUrl),
    );
  } catch (error) {
    if (error instanceof CliError) {
      writeSafe(stderr, `${error.message}\n`, [databaseUrl]);
      return error.exitCode;
    }

    if (error instanceof Error) {
      writeSafe(stderr, `${error.message}\n`, [databaseUrl]);
      return 1;
    }

    writeSafe(stderr, "Unknown production database command failure.\n", [
      databaseUrl,
    ]);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const exitCode = await runProductionDbCommand(process.argv.slice(2));
  process.exitCode = exitCode;
}
