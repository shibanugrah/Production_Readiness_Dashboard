-- AlterEnum
ALTER TYPE "OperationalEventStatus" ADD VALUE IF NOT EXISTS 'ACKNOWLEDGED';
ALTER TYPE "OperationalEventStatus" ADD VALUE IF NOT EXISTS 'RESOLVED';

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'RESOLVED');

-- AlterTable
ALTER TABLE "OperationalEvent" ADD COLUMN "acknowledgedAt" TIMESTAMP(3),
ADD COLUMN "acknowledgedByUserId" TEXT,
ADD COLUMN "resolvedAt" TIMESTAMP(3),
ADD COLUMN "resolvedByUserId" TEXT,
ADD COLUMN "resolutionNote" TEXT,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "serviceId" TEXT,
    "sourceEventId" TEXT,
    "title" TEXT NOT NULL,
    "severity" "OperationalEventSeverity" NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "ownerUserId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "summary" TEXT NOT NULL,
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OperationalEvent_acknowledgedByUserId_idx" ON "OperationalEvent"("acknowledgedByUserId");

-- CreateIndex
CREATE INDEX "OperationalEvent_resolvedByUserId_idx" ON "OperationalEvent"("resolvedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Incident_sourceEventId_key" ON "Incident"("sourceEventId");

-- CreateIndex
CREATE INDEX "Incident_workspaceId_status_severity_startedAt_idx" ON "Incident"("workspaceId", "status", "severity", "startedAt");

-- CreateIndex
CREATE INDEX "Incident_workspaceId_updatedAt_idx" ON "Incident"("workspaceId", "updatedAt");

-- CreateIndex
CREATE INDEX "Incident_serviceId_idx" ON "Incident"("serviceId");

-- CreateIndex
CREATE INDEX "Incident_ownerUserId_idx" ON "Incident"("ownerUserId");

-- AddForeignKey
ALTER TABLE "OperationalEvent" ADD CONSTRAINT "OperationalEvent_acknowledgedByUserId_fkey" FOREIGN KEY ("acknowledgedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalEvent" ADD CONSTRAINT "OperationalEvent_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_sourceEventId_fkey" FOREIGN KEY ("sourceEventId") REFERENCES "OperationalEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DropDefault
ALTER TABLE "OperationalEvent" ALTER COLUMN "updatedAt" DROP DEFAULT;
