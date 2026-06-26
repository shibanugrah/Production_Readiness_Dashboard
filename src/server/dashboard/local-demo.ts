export function isLocalDemoActionsEnabled(environment = process.env) {
  return (
    environment.APP_VERSION === "local" &&
    environment.HEALTH_CHECK_LOCAL_ALLOWLIST_ENABLED === "true"
  );
}
