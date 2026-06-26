process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/production_readiness_dashboard?schema=public";
process.env.AUTH_SECRET ??= "test-auth-secret";
process.env.INTERNAL_HEALTH_CHECK_SECRET ??= "test-health-secret";
Reflect.set(process.env, "NODE_ENV", "test");
process.env.APP_VERSION ??= "test";
