import {
  HealthCheckRunStatus,
  HealthCheckRunTriggerType,
  HealthCheckStatus,
  PrismaClient,
  ServiceEnvironment,
  ServiceStatus,
  WorkspaceRole,
} from "@prisma/client";

import { prisma } from "@/server/db";
import {
  getPublicDemoRuntimeConfig,
  getPublicDemoRuntimeConfigIssues,
  isPublicDemoAccessEnabled,
  publicDemoRecentHealthyWindowHours,
  publicDemoSelfMonitor,
  publicDemoWorkspace,
} from "@/server/public-demo-config";

type PublicDemoClient = Pick<
  PrismaClient,
  "healthCheck" | "service" | "user" | "workspace"
>;

export type PublicDemoAvailability =
  | {
      kind: "disabled";
      message: string;
    }
  | {
      kind: "unavailable";
      message: string;
      operatorHint: string;
    }
  | {
      kind: "available";
      message: string;
      viewerUserId: string;
      workspaceId: string;
      workspaceSlug: string;
      latestHealthyCheckedAt: Date;
    };

const unavailableOperatorHint =
  "Operator setup: seed the public demo workspace, sign in as the public demo Owner, run one manual check, and confirm scheduler remains Not configured.";

function unavailable(message: string): PublicDemoAvailability {
  return {
    kind: "unavailable",
    message,
    operatorHint: unavailableOperatorHint,
  };
}

function recentHealthySince(now: Date) {
  return new Date(
    now.getTime() - publicDemoRecentHealthyWindowHours * 60 * 60 * 1_000,
  );
}

export async function getPublicDemoAvailability({
  client = prisma,
  environment = process.env,
  now = () => new Date(),
}: {
  client?: PublicDemoClient;
  environment?: NodeJS.ProcessEnv;
  now?: () => Date;
} = {}): Promise<PublicDemoAvailability> {
  if (!isPublicDemoAccessEnabled(environment)) {
    return {
      kind: "disabled",
      message: "Public demo access is disabled.",
    };
  }

  const config = getPublicDemoRuntimeConfig(environment);

  if (!config) {
    return unavailable(
      "Public demo access is not fully configured on the server.",
    );
  }

  try {
    const workspace = await client.workspace.findUnique({
      where: { slug: publicDemoWorkspace.slug },
      select: {
        id: true,
        slug: true,
      },
    });

    if (!workspace) {
      return unavailable("Public demo workspace has not been seeded yet.");
    }

    const viewer = await client.user.findUnique({
      where: { email: config.viewerEmail },
      select: {
        id: true,
        memberships: {
          select: {
            role: true,
            workspaceId: true,
            workspace: {
              select: {
                slug: true,
              },
            },
          },
        },
      },
    });

    const viewerMembership = viewer?.memberships.find(
      (membership) => membership.workspace.slug === publicDemoWorkspace.slug,
    );
    const hasNonPublicMembership = viewer?.memberships.some(
      (membership) => membership.workspace.slug !== publicDemoWorkspace.slug,
    );

    if (
      !viewer ||
      !viewerMembership ||
      viewerMembership.workspaceId !== workspace.id ||
      viewerMembership.role !== WorkspaceRole.VIEWER ||
      hasNonPublicMembership
    ) {
      return unavailable(
        "Public demo Viewer account is not isolated to the read-only public demo workspace.",
      );
    }

    const activeServices = await client.service.findMany({
      where: {
        workspaceId: workspace.id,
        isActive: true,
      },
      select: {
        id: true,
        slug: true,
        name: true,
        baseUrl: true,
        healthPath: true,
        environment: true,
        expectedVersion: true,
        status: true,
        lastHealthyAt: true,
      },
      orderBy: { name: "asc" },
    });
    const [service] = activeServices;

    if (
      activeServices.length !== 1 ||
      !service ||
      service.slug !== publicDemoSelfMonitor.slug ||
      service.name !== publicDemoSelfMonitor.name
    ) {
      return unavailable(
        "Public demo must have exactly one active self-monitor service.",
      );
    }

    if (
      service.baseUrl !== config.appBaseUrl ||
      service.healthPath !== publicDemoSelfMonitor.healthPath ||
      service.environment !== ServiceEnvironment.PRODUCTION ||
      service.expectedVersion !== config.appVersion
    ) {
      return unavailable(
        "Public demo self-monitor service does not match the configured deployed app URL and version.",
      );
    }

    const latestCheck = await client.healthCheck.findFirst({
      where: {
        workspaceId: workspace.id,
        serviceId: service.id,
      },
      orderBy: { checkedAt: "desc" },
      select: {
        status: true,
        checkedAt: true,
        observedVersion: true,
        run: {
          select: {
            triggerType: true,
            status: true,
          },
        },
      },
    });
    const since = recentHealthySince(now());

    if (
      service.status !== ServiceStatus.HEALTHY ||
      !service.lastHealthyAt ||
      service.lastHealthyAt < since ||
      !latestCheck ||
      latestCheck.checkedAt < since ||
      latestCheck.status !== HealthCheckStatus.SUCCESS ||
      latestCheck.observedVersion !== service.expectedVersion ||
      latestCheck.run?.triggerType !== HealthCheckRunTriggerType.MANUAL ||
      latestCheck.run?.status !== HealthCheckRunStatus.COMPLETED
    ) {
      return unavailable(
        "Public demo is waiting for a recent real successful Owner/Admin manual check.",
      );
    }

    return {
      kind: "available",
      message: "Read-only public demo is ready.",
      viewerUserId: viewer.id,
      workspaceId: workspace.id,
      workspaceSlug: workspace.slug,
      latestHealthyCheckedAt: latestCheck.checkedAt,
    };
  } catch {
    return unavailable("Public demo availability could not be verified.");
  }
}

export function publicDemoConfigurationIssues(
  environment: NodeJS.ProcessEnv = process.env,
) {
  if (!isPublicDemoAccessEnabled(environment)) {
    return [];
  }

  return getPublicDemoRuntimeConfigIssues(environment);
}
