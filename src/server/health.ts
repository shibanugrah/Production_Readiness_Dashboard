import { prisma } from "@/server/db";
import { validateEnv } from "@/env";

type DatabaseClient = {
  $queryRawUnsafe: (query: string) => Promise<unknown>;
};

export type HealthSuccessBody = {
  status: "ok";
  service: "production-readiness-dashboard";
  version: string;
  timestamp: string;
  database: "connected";
};

export type HealthFailureBody = {
  status: "error";
  service: "production-readiness-dashboard";
  version: string;
  timestamp: string;
  database: "unavailable";
};

export type HealthResponse = {
  httpStatus: 200 | 503;
  body: HealthSuccessBody | HealthFailureBody;
};

const serviceName = "production-readiness-dashboard";

export async function checkDatabase(client: DatabaseClient = prisma) {
  await client.$queryRawUnsafe("SELECT 1");
}

export async function buildHealthResponse({
  client = prisma,
  environment = process.env,
  now = () => new Date(),
}: {
  client?: DatabaseClient;
  environment?: NodeJS.ProcessEnv;
  now?: () => Date;
} = {}): Promise<HealthResponse> {
  const timestamp = now().toISOString();
  let version = environment.APP_VERSION ?? "local-or-app-version";

  try {
    const env = validateEnv(environment);
    version = env.APP_VERSION ?? "local-or-app-version";
    await checkDatabase(client);

    return {
      httpStatus: 200,
      body: {
        status: "ok",
        service: serviceName,
        version,
        timestamp,
        database: "connected",
      },
    };
  } catch {
    return {
      httpStatus: 503,
      body: {
        status: "error",
        service: serviceName,
        version,
        timestamp,
        database: "unavailable",
      },
    };
  }
}
