process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/production_readiness_dashboard?schema=public";
process.env.AUTH_SECRET ??= "test-auth-secret";
process.env.INTERNAL_HEALTH_CHECK_SECRET ??= "test-health-secret";
Reflect.set(process.env, "NODE_ENV", "test");
process.env.APP_VERSION ??= "test";
process.env.DEMO_OWNER_EMAIL ??= "owner@example.local";
process.env.DEMO_OWNER_PASSWORD ??= "test-owner-password";
process.env.DEMO_ADMIN_EMAIL ??= "admin@example.local";
process.env.DEMO_ADMIN_PASSWORD ??= "test-admin-password";
process.env.DEMO_VIEWER_EMAIL ??= "viewer@example.local";
process.env.DEMO_VIEWER_PASSWORD ??= "test-viewer-password";
