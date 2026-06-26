-- AlterTable
ALTER TABLE "Service" ADD COLUMN "lastCheckedAt" TIMESTAMP(3),
ADD COLUMN "lastHealthyAt" TIMESTAMP(3),
ADD COLUMN "checkLockToken" TEXT,
ADD COLUMN "checkLockExpiresAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "HealthCheck" ADD COLUMN "requestId" TEXT NOT NULL,
ADD COLUMN "migrationVersion" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "HealthCheck_requestId_key" ON "HealthCheck"("requestId");

-- CreateIndex
CREATE INDEX "Service_checkLockExpiresAt_idx" ON "Service"("checkLockExpiresAt");
