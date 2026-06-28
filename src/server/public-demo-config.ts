import { isIP } from "node:net";

export const publicDemoWorkspace = {
  name: "Public Demo",
  slug: "public-recruiter-demo",
} as const;

export const publicDemoSelfMonitor = {
  name: "Production Readiness Dashboard",
  slug: "production-readiness-dashboard",
  healthPath: "/api/health",
} as const;

export const publicDemoInactiveFailureService = {
  name: "Inactive Failure Demo Service",
  slug: "inactive-failure-demo-service",
  healthPath: "/api/demo-service/health?mode=down",
} as const;

export const publicDemoRecentHealthyWindowHours = 24;

export type PublicDemoRuntimeConfig = {
  appBaseUrl: string;
  appVersion: string;
  viewerEmail: string;
};

export type PublicDemoSeedConfig = PublicDemoRuntimeConfig & {
  ownerEmail: string;
  ownerPassword: string;
};

export type PublicDemoSeedService = {
  name: string;
  slug: string;
  baseUrl: string;
  healthPath: string;
  expectedVersion: string;
  isActive: boolean;
};

function cleanEnvValue(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function isUnsafePublicDemoHostname(hostname: string) {
  const normalized = hostname.toLowerCase();

  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized === "app" ||
    normalized === "postgres" ||
    !normalized.includes(".")
  ) {
    return true;
  }

  if (normalized === "169.254.169.254") {
    return true;
  }

  const ipVersion = isIP(normalized);

  if (ipVersion === 4) {
    const [first = 0, second = 0] = normalized.split(".").map(Number);

    return (
      first === 0 ||
      first === 10 ||
      first === 127 ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168)
    );
  }

  if (ipVersion === 6) {
    return (
      normalized === "::1" ||
      normalized.startsWith("fe80:") ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd")
    );
  }

  return false;
}

export function publicDemoBaseUrlIssue(
  value: string | null,
  environment: NodeJS.ProcessEnv = process.env,
) {
  if (!value) {
    return "PUBLIC_DEMO_APP_BASE_URL is required when public demo access is enabled.";
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return "PUBLIC_DEMO_APP_BASE_URL must be a valid public app URL.";
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return "PUBLIC_DEMO_APP_BASE_URL must use http or https.";
  }

  if (environment.NODE_ENV === "production" && url.protocol !== "https:") {
    return "PUBLIC_DEMO_APP_BASE_URL must use HTTPS in production.";
  }

  if (url.username || url.password) {
    return "PUBLIC_DEMO_APP_BASE_URL must not contain credentials.";
  }

  if (isUnsafePublicDemoHostname(url.hostname)) {
    return "PUBLIC_DEMO_APP_BASE_URL must be a public deployed app URL, not localhost, Docker, metadata, or a private network target.";
  }

  return null;
}

export function isPublicDemoAccessEnabled(
  environment: NodeJS.ProcessEnv = process.env,
) {
  return environment.PUBLIC_DEMO_ACCESS_ENABLED === "true";
}

export function getPublicDemoRuntimeConfigIssues(
  environment: NodeJS.ProcessEnv = process.env,
) {
  const issues: string[] = [];
  const appBaseUrl = cleanEnvValue(environment.PUBLIC_DEMO_APP_BASE_URL);
  const appVersion = cleanEnvValue(environment.APP_VERSION);
  const viewerEmail = cleanEnvValue(environment.PUBLIC_DEMO_VIEWER_EMAIL);
  const baseUrlIssue = publicDemoBaseUrlIssue(appBaseUrl, environment);

  if (baseUrlIssue) {
    issues.push(baseUrlIssue);
  }

  if (!appVersion) {
    issues.push("APP_VERSION is required for public demo self-monitoring.");
  }

  if (!viewerEmail) {
    issues.push("PUBLIC_DEMO_VIEWER_EMAIL is required when public demo access is enabled.");
  }

  return issues;
}

export function getPublicDemoRuntimeConfig(
  environment: NodeJS.ProcessEnv = process.env,
): PublicDemoRuntimeConfig | null {
  if (!isPublicDemoAccessEnabled(environment)) {
    return null;
  }

  if (getPublicDemoRuntimeConfigIssues(environment).length > 0) {
    return null;
  }

  return {
    appBaseUrl: cleanEnvValue(environment.PUBLIC_DEMO_APP_BASE_URL) as string,
    appVersion: cleanEnvValue(environment.APP_VERSION) as string,
    viewerEmail: (cleanEnvValue(environment.PUBLIC_DEMO_VIEWER_EMAIL) as string).toLowerCase(),
  };
}

export function getPublicDemoSeedConfig(
  environment: NodeJS.ProcessEnv = process.env,
): PublicDemoSeedConfig | null {
  const runtimeIssues = getPublicDemoRuntimeConfigIssues(environment);
  const ownerEmail = cleanEnvValue(environment.PUBLIC_DEMO_OWNER_EMAIL);
  const ownerPassword = cleanEnvValue(environment.PUBLIC_DEMO_OWNER_PASSWORD);

  if (!ownerEmail) {
    runtimeIssues.push("PUBLIC_DEMO_OWNER_EMAIL is required to seed the public demo operator account.");
  }

  if (!ownerPassword) {
    runtimeIssues.push("PUBLIC_DEMO_OWNER_PASSWORD is required to seed the public demo operator account.");
  }

  if (runtimeIssues.length > 0) {
    return null;
  }

  const requiredOwnerEmail = ownerEmail as string;
  const requiredOwnerPassword = ownerPassword as string;

  return {
    appBaseUrl: cleanEnvValue(environment.PUBLIC_DEMO_APP_BASE_URL) as string,
    appVersion: cleanEnvValue(environment.APP_VERSION) as string,
    viewerEmail: (cleanEnvValue(environment.PUBLIC_DEMO_VIEWER_EMAIL) as string).toLowerCase(),
    ownerEmail: requiredOwnerEmail.toLowerCase(),
    ownerPassword: requiredOwnerPassword,
  };
}

export function hasPublicDemoSeedConfig(environment: NodeJS.ProcessEnv = process.env) {
  return getPublicDemoSeedConfig(environment) !== null;
}

export function getPublicDemoSeedServices(
  config: Pick<PublicDemoRuntimeConfig, "appBaseUrl" | "appVersion">,
): PublicDemoSeedService[] {
  return [
    {
      name: publicDemoSelfMonitor.name,
      slug: publicDemoSelfMonitor.slug,
      baseUrl: config.appBaseUrl,
      healthPath: publicDemoSelfMonitor.healthPath,
      expectedVersion: config.appVersion,
      isActive: true,
    },
    {
      name: publicDemoInactiveFailureService.name,
      slug: publicDemoInactiveFailureService.slug,
      baseUrl: config.appBaseUrl,
      healthPath: publicDemoInactiveFailureService.healthPath,
      expectedVersion: config.appVersion,
      isActive: false,
    },
  ];
}
