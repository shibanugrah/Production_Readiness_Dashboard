import {
  PrismaClient,
  ServiceEnvironment,
  ServiceStatus,
  WorkspaceRole,
} from "@prisma/client";

import { hashPassword } from "../src/server/auth/password";

const prisma = new PrismaClient();

const demoWorkspace = {
  name: "Portfolio Operations",
  slug: "portfolio-operations",
};

const legacyDemoUserId = "local-demo-owner";

function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required demo auth environment variable: ${name}`);
  }

  return value;
}

async function upsertDemoUser({
  name,
  email,
  password,
}: {
  name: string;
  email: string;
  password: string;
}) {
  return prisma.user.upsert({
    where: { email },
    update: {
      name,
      passwordHash: await hashPassword(password),
    },
    create: {
      name,
      email,
      passwordHash: await hashPassword(password),
    },
  });
}

async function main() {
  const workspace = await prisma.workspace.upsert({
    where: { slug: demoWorkspace.slug },
    update: { name: demoWorkspace.name },
    create: demoWorkspace,
  });

  await prisma.workspaceMember.deleteMany({
    where: { workspaceId: workspace.id, userId: legacyDemoUserId },
  });
  await prisma.user.deleteMany({ where: { id: legacyDemoUserId } });

  const demoUsers = [
    {
      name: "Demo Owner",
      email: requiredEnv("DEMO_OWNER_EMAIL").toLowerCase(),
      password: requiredEnv("DEMO_OWNER_PASSWORD"),
      role: WorkspaceRole.OWNER,
    },
    {
      name: "Demo Admin",
      email: requiredEnv("DEMO_ADMIN_EMAIL").toLowerCase(),
      password: requiredEnv("DEMO_ADMIN_PASSWORD"),
      role: WorkspaceRole.ADMIN,
    },
    {
      name: "Demo Viewer",
      email: requiredEnv("DEMO_VIEWER_EMAIL").toLowerCase(),
      password: requiredEnv("DEMO_VIEWER_PASSWORD"),
      role: WorkspaceRole.VIEWER,
    },
  ];

  for (const demoUser of demoUsers) {
    const user = await upsertDemoUser(demoUser);

    await prisma.workspaceMember.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId: user.id,
        },
      },
      update: { role: demoUser.role },
      create: {
        workspaceId: workspace.id,
        userId: user.id,
        role: demoUser.role,
      },
    });
  }

  const services = [
    {
      name: "Production Readiness Dashboard",
      slug: "production-readiness-dashboard",
      baseUrl: "http://app:3000",
      healthPath: "/api/health",
      environment: ServiceEnvironment.LOCAL,
      expectedVersion: "local",
      isActive: true,
    },
    {
      name: "Demo Monitored Service",
      slug: "demo-monitored-service",
      baseUrl: "http://app:3000",
      healthPath: "/api/demo-service/health",
      environment: ServiceEnvironment.LOCAL,
      expectedVersion: "local-demo",
      isActive: true,
    },
    {
      name: "Inactive Placeholder Service",
      slug: "inactive-placeholder-service",
      baseUrl: "http://app:3000",
      healthPath: "/api/demo-service/health",
      environment: ServiceEnvironment.LOCAL,
      expectedVersion: null,
      isActive: false,
    },
  ];

  for (const service of services) {
    await prisma.service.upsert({
      where: {
        workspaceId_slug: {
          workspaceId: workspace.id,
          slug: service.slug,
        },
      },
      update: {
        name: service.name,
        baseUrl: service.baseUrl,
        healthPath: service.healthPath,
        environment: service.environment,
        expectedVersion: service.expectedVersion,
        isActive: service.isActive,
      },
      create: {
        workspaceId: workspace.id,
        status: ServiceStatus.UNKNOWN,
        ...service,
      },
    });
  }

  console.log(
    `Seeded workspace "${workspace.name}" with ${services.length} services and ${demoUsers.length} demo users.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
