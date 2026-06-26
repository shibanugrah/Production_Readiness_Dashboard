import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import { CheckableService } from "@/server/health-checks/types";

export type DnsResolver = (
  hostname: string,
) => Promise<Array<{ address: string; family: number }>>;

export type TargetSafetyOptions = {
  environment?: NodeJS.ProcessEnv;
  resolver?: DnsResolver;
};

export class UnsafeHealthCheckTargetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeHealthCheckTargetError";
  }
}

const defaultResolver: DnsResolver = async (hostname) => {
  const results = await lookup(hostname, { all: true, verbatim: true });
  return results.map((result) => ({
    address: result.address,
    family: result.family,
  }));
};

function getPort(url: URL) {
  if (url.port) {
    return url.port;
  }

  return url.protocol === "https:" ? "443" : "80";
}

function getAllowedLocalTargets(environment: NodeJS.ProcessEnv) {
  return new Set(
    (environment.HEALTH_CHECK_LOCAL_ALLOWED_TARGETS ?? "")
      .split(",")
      .map((target) => target.trim().toLowerCase())
      .filter(Boolean),
  );
}

function isLocalDevelopmentTargetAllowed(
  url: URL,
  environment: NodeJS.ProcessEnv,
) {
  const localAllowlistEnabled =
    environment.HEALTH_CHECK_LOCAL_ALLOWLIST_ENABLED === "true" &&
    environment.APP_VERSION === "local";

  if (!localAllowlistEnabled) {
    return false;
  }

  const allowedTargets = getAllowedLocalTargets(environment);
  return allowedTargets.has(`${url.hostname.toLowerCase()}:${getPort(url)}`);
}

function parseIpv4(address: string) {
  const parts = address.split(".");

  if (parts.length !== 4) {
    return null;
  }

  const octets = parts.map((part) => Number(part));

  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return null;
  }

  return octets;
}

function isUnsafeIpv4(address: string) {
  const octets = parseIpv4(address);

  if (!octets) {
    return false;
  }

  const [first, second] = octets;

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function isUnsafeIpv6(address: string) {
  const normalized = address.toLowerCase();

  return (
    normalized === "::1" ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("::ffff:127.") ||
    normalized.startsWith("::ffff:10.") ||
    normalized.startsWith("::ffff:192.168.") ||
    normalized.startsWith("::ffff:169.254.")
  );
}

export function isUnsafeIpAddress(address: string) {
  const ipVersion = isIP(address);

  if (ipVersion === 4) {
    return isUnsafeIpv4(address);
  }

  if (ipVersion === 6) {
    return isUnsafeIpv6(address);
  }

  return false;
}

function isLocalHostname(hostname: string) {
  const normalized = hostname.toLowerCase();
  return normalized === "localhost" || normalized.endsWith(".localhost");
}

export function buildHealthCheckUrl(service: Pick<CheckableService, "baseUrl" | "healthPath">) {
  return new URL(service.healthPath, service.baseUrl);
}

export async function validateHealthCheckTarget(
  service: Pick<CheckableService, "baseUrl" | "healthPath">,
  options: TargetSafetyOptions = {},
) {
  const environment = options.environment ?? process.env;
  const resolver = options.resolver ?? defaultResolver;
  const url = buildHealthCheckUrl(service);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeHealthCheckTargetError("Health check target must use http or https.");
  }

  if (url.username || url.password) {
    throw new UnsafeHealthCheckTargetError("Health check target must not contain credentials.");
  }

  if (isLocalDevelopmentTargetAllowed(url, environment)) {
    return url;
  }

  const hostname = url.hostname;

  if (isLocalHostname(hostname)) {
    throw new UnsafeHealthCheckTargetError("Health check target must not use localhost.");
  }

  if (hostname === "169.254.169.254") {
    throw new UnsafeHealthCheckTargetError(
      "Health check target must not use cloud metadata addresses.",
    );
  }

  if (isIP(hostname)) {
    if (isUnsafeIpAddress(hostname)) {
      throw new UnsafeHealthCheckTargetError(
        "Health check target must not use private network addresses.",
      );
    }

    return url;
  }

  const resolvedAddresses = await resolver(hostname);

  if (resolvedAddresses.length === 0) {
    throw new UnsafeHealthCheckTargetError("Health check target DNS lookup returned no addresses.");
  }

  if (resolvedAddresses.some((result) => isUnsafeIpAddress(result.address))) {
    throw new UnsafeHealthCheckTargetError(
      "Health check target DNS lookup resolved to a private network address.",
    );
  }

  return url;
}
