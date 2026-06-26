import {
  PrismaClient,
  ServiceEnvironment,
  ServiceStatus,
  WorkspaceRole,
} from "@prisma/client";

const prisma = new PrismaClient();

const demoWorkspace = {
  name: "Portfolio Operations",
  slug: "portfolio-operations",
};

const demoUserId = "local-demo-owner";

async function main() {
  const workspace = await prisma.workspace.upsert({
    where: { slug: demoWorkspace.slug },
    update: { name: demoWorkspace.name },
    create: demoWorkspace,
  });

  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: demoUserId,
      },
    },
    update: { role: WorkspaceRole.OWNER },
    create: {
      workspaceId: workspace.id,
      userId: demoUserId,
      role: WorkspaceRole.OWNER,
    },
  });

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
    `Seeded workspace "${workspace.name}" with ${services.length} services.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
