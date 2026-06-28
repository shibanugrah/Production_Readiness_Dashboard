import {
  PrismaClient,
  ServiceEnvironment,
  ServiceStatus,
  WorkspaceRole,
} from "@prisma/client";

import { hashPassword } from "../src/server/auth/password";
import {
  getPublicDemoSeedConfig,
  getPublicDemoSeedServices,
  publicDemoWorkspace,
} from "../src/server/public-demo-config";

const prisma = new PrismaClient();

const demoWorkspace = {
  name: "Portfolio Operations",
  slug: "portfolio-operations",
};

const legacyDemoUserId = "local-demo-owner";

function envValue(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function requiredEnv(name: string) {
  const value = envValue(name);

  if (!value) {
    throw new Error(`Missing required demo auth environment variable: ${name}`);
  }

  return value;
}

function anyEnv(names: string[]) {
  return names.some((name) => envValue(name));
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
  const passwordHash = await hashPassword(password);

  return prisma.user.upsert({
    where: { email },
    update: {
      name,
      passwordHash,
    },
    create: {
      name,
      email,
      passwordHash,
    },
  });
}

async function upsertDedicatedPublicDemoUser({
  name,
  email,
  password,
}: {
  name: string;
  email: string;
  password?: string;
}) {
  const existing = await prisma.user.findUnique({
    where: { email },
    include: {
      memberships: {
        select: {
          workspace: {
            select: {
              slug: true,
            },
          },
        },
      },
    },
  });
  const hasNonPublicDemoMembership = existing?.memberships.some(
    (membership) => membership.workspace.slug !== publicDemoWorkspace.slug,
  );

  if (hasNonPublicDemoMembership) {
    throw new Error(
      `${email} already belongs to another workspace. Public demo users must be dedicated to ${publicDemoWorkspace.slug}.`,
    );
  }

  if (!password && existing?.passwordHash) {
    throw new Error(
      "PUBLIC_DEMO_VIEWER_EMAIL must identify a dedicated passwordless Viewer account.",
    );
  }

  const passwordHash = password ? await hashPassword(password) : null;

  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        name,
        passwordHash,
      },
    });
  }

  return prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
    },
  });
}

async function seedPortfolioOperations() {
  const portfolioEnvNames = [
    "DEMO_OWNER_EMAIL",
    "DEMO_OWNER_PASSWORD",
    "DEMO_ADMIN_EMAIL",
    "DEMO_ADMIN_PASSWORD",
    "DEMO_VIEWER_EMAIL",
    "DEMO_VIEWER_PASSWORD",
  ];

  if (!anyEnv(portfolioEnvNames)) {
    return null;
  }

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

  return {
    workspaceName: workspace.name,
    userCount: demoUsers.length,
    serviceCount: services.length,
  };
}

async function seedPublicDemoWorkspace() {
  const config = getPublicDemoSeedConfig();

  if (!config) {
    return null;
  }

  const workspace = await prisma.workspace.upsert({
    where: { slug: publicDemoWorkspace.slug },
    update: { name: publicDemoWorkspace.name },
    create: publicDemoWorkspace,
  });
  const owner = await upsertDedicatedPublicDemoUser({
    name: "Public Demo Owner",
    email: config.ownerEmail,
    password: config.ownerPassword,
  });
  const viewer = await upsertDedicatedPublicDemoUser({
    name: "Public Demo Viewer",
    email: config.viewerEmail,
  });
  const demoUsers = [
    { user: owner, role: WorkspaceRole.OWNER },
    { user: viewer, role: WorkspaceRole.VIEWER },
  ];

  for (const demoUser of demoUsers) {
    await prisma.workspaceMember.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId: demoUser.user.id,
        },
      },
      update: { role: demoUser.role },
      create: {
        workspaceId: workspace.id,
        userId: demoUser.user.id,
        role: demoUser.role,
      },
    });
  }

  const services = getPublicDemoSeedServices(config);

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
        environment: ServiceEnvironment.PRODUCTION,
        expectedVersion: service.expectedVersion,
        isActive: service.isActive,
      },
      create: {
        workspaceId: workspace.id,
        status: ServiceStatus.UNKNOWN,
        environment: ServiceEnvironment.PRODUCTION,
        ...service,
      },
    });
  }

  return {
    workspaceName: workspace.name,
    userCount: demoUsers.length,
    serviceCount: services.length,
  };
}

async function main() {
  const portfolioSeed = await seedPortfolioOperations();
  const publicSeed = await seedPublicDemoWorkspace();

  if (!portfolioSeed && !publicSeed) {
    throw new Error(
      "No seed configuration found. Set local DEMO_* values or public-demo seed values before running npm run db:seed.",
    );
  }

  if (portfolioSeed) {
    console.log(
      `Seeded workspace "${portfolioSeed.workspaceName}" with ${portfolioSeed.serviceCount} services and ${portfolioSeed.userCount} demo users.`,
    );
  }

  if (publicSeed) {
    console.log(
      `Seeded workspace "${publicSeed.workspaceName}" with ${publicSeed.serviceCount} public-safe services and ${publicSeed.userCount} demo users.`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
