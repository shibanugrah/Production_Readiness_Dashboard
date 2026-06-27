-- CreateEnum
CREATE TYPE "HealthCheckRunTriggerType" AS ENUM ('MANUAL', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "HealthCheckRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED');

-- AlterTable
ALTER TABLE "HealthCheck" ADD COLUMN "runId" TEXT;

-- CreateTable
CREATE TABLE "HealthCheckRun" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "triggerType" "HealthCheckRunTriggerType" NOT NULL,
    "status" "HealthCheckRunStatus" NOT NULL DEFAULT 'RUNNING',
    "requestedByUserId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "checkedCount" INTEGER NOT NULL DEFAULT 0,
    "healthyCount" INTEGER NOT NULL DEFAULT 0,
    "degradedCount" INTEGER NOT NULL DEFAULT 0,
    "downCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthCheckRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthCheckRunLease" (
    "workspaceId" TEXT NOT NULL,
    "lockToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthCheckRunLease_pkey" PRIMARY KEY ("workspaceId")
);

-- CreateIndex
CREATE INDEX "HealthCheck_workspaceId_runId_idx" ON "HealthCheck"("workspaceId", "runId");

-- CreateIndex
CREATE INDEX "HealthCheckRun_workspaceId_startedAt_idx" ON "HealthCheckRun"("workspaceId", "startedAt");

-- CreateIndex
CREATE INDEX "HealthCheckRun_workspaceId_triggerType_startedAt_idx" ON "HealthCheckRun"("workspaceId", "triggerType", "startedAt");

-- CreateIndex
CREATE INDEX "HealthCheckRun_workspaceId_status_startedAt_idx" ON "HealthCheckRun"("workspaceId", "status", "startedAt");

-- CreateIndex
CREATE INDEX "HealthCheckRun_requestedByUserId_idx" ON "HealthCheckRun"("requestedByUserId");

-- CreateIndex
CREATE INDEX "HealthCheckRunLease_expiresAt_idx" ON "HealthCheckRunLease"("expiresAt");

-- AddForeignKey
ALTER TABLE "HealthCheck" ADD CONSTRAINT "HealthCheck_runId_fkey" FOREIGN KEY ("runId") REFERENCES "HealthCheckRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthCheckRun" ADD CONSTRAINT "HealthCheckRun_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthCheckRun" ADD CONSTRAINT "HealthCheckRun_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthCheckRunLease" ADD CONSTRAINT "HealthCheckRunLease_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
