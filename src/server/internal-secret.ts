import { createHash, timingSafeEqual } from "node:crypto";

export function getProvidedInternalSecret(request: Request) {
  const directSecret = request.headers.get("x-internal-health-check-secret");

  if (directSecret) {
    return directSecret;
  }

  const authorization = request.headers.get("authorization");
  const bearerPrefix = "Bearer ";

  if (authorization?.startsWith(bearerPrefix)) {
    return authorization.slice(bearerPrefix.length);
  }

  return null;
}

function hashSecret(secret: string) {
  return createHash("sha256").update(secret).digest();
}

export function internalSecretsMatch(
  providedSecret: string,
  expectedSecret: string,
) {
  return timingSafeEqual(hashSecret(providedSecret), hashSecret(expectedSecret));
}
