import { randomUUID } from "node:crypto";

import { validateHealthCheckTarget } from "@/server/health-checks/target-safety";
import {
  CheckableService,
  ExecutedCheck,
} from "@/server/health-checks/types";

export type HealthCheckFetch = typeof fetch;

export type ExecuteHealthCheckOptions = {
  fetchImpl?: HealthCheckFetch;
  now?: () => Date;
  timeoutMs?: number;
  maxResponseBytes?: number;
  environment?: NodeJS.ProcessEnv;
};

const defaultTimeoutMs = 5_000;
const defaultMaxResponseBytes = 64 * 1024;

function getSafeErrorMessage(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "Health check request timed out.";
  }

  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return "Health check request timed out.";
    }

    return error.message.slice(0, 240);
  }

  return "Health check request failed.";
}

async function readBoundedResponseBody(
  response: Response,
  maxResponseBytes: number,
) {
  if (!response.body) {
    const text = await response.text();

    if (Buffer.byteLength(text, "utf8") > maxResponseBytes) {
      throw new Error("Health endpoint response exceeded the maximum allowed size.");
    }

    return text;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const result = await reader.read();

    if (result.done) {
      break;
    }

    totalBytes += result.value.byteLength;

    if (totalBytes > maxResponseBytes) {
      throw new Error("Health endpoint response exceeded the maximum allowed size.");
    }

    chunks.push(result.value);
  }

  return new TextDecoder().decode(Buffer.concat(chunks));
}

function parseJsonResponse(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("Health endpoint returned invalid JSON.");
  }
}

export async function executeHealthCheck(
  service: CheckableService,
  options: ExecuteHealthCheckOptions = {},
): Promise<ExecutedCheck> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => new Date());
  const timeoutMs = options.timeoutMs ?? defaultTimeoutMs;
  const maxResponseBytes =
    options.maxResponseBytes ?? defaultMaxResponseBytes;
  const requestId = randomUUID();
  const checkedAt = now();
  const startedAt = performance.now();
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    const targetUrl = await validateHealthCheckTarget(service, {
      environment: options.environment,
    });
    const controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetchImpl(targetUrl, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
    });
    const responseTimeMs = Math.max(0, Math.round(performance.now() - startedAt));
    const redirected =
      (response.status >= 300 && response.status < 400) ||
      response.redirected ||
      response.headers.has("location");

    if (redirected) {
      return {
        requestId,
        checkedAt,
        responseTimeMs,
        httpStatus: response.status,
        payload: null,
        errorMessage: null,
        redirected: true,
      };
    }

    let payload: unknown = null;
    let errorMessage: string | null = null;

    try {
      const body = await readBoundedResponseBody(response, maxResponseBytes);
      payload = parseJsonResponse(body);
    } catch (error) {
      errorMessage = getSafeErrorMessage(error);
    }

    return {
      requestId,
      checkedAt,
      responseTimeMs,
      httpStatus: response.status,
      payload,
      errorMessage,
      redirected: false,
    };
  } catch (error) {
    return {
      requestId,
      checkedAt,
      responseTimeMs: Math.max(0, Math.round(performance.now() - startedAt)),
      httpStatus: null,
      payload: null,
      errorMessage: getSafeErrorMessage(error),
      redirected: false,
    };
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
