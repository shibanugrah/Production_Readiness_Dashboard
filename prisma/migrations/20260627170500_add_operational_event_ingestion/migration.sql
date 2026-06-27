-- CreateEnum
CREATE TYPE "OperationalEventStatus" AS ENUM ('OPEN');

-- AlterTable
ALTER TABLE "OperationalEvent" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'legacy',
ADD COLUMN "status" "OperationalEventStatus" NOT NULL DEFAULT 'OPEN',
ADD COLUMN "externalReference" TEXT,
ADD COLUMN "errorMessage" TEXT,
ADD COLUMN "payloadHash" TEXT NOT NULL DEFAULT 'legacy',
ADD COLUMN "idempotencyKey" TEXT;

UPDATE "OperationalEvent"
SET "idempotencyKey" = md5(random()::text || clock_timestamp()::text)
WHERE "idempotencyKey" IS NULL;

ALTER TABLE "OperationalEvent" ALTER COLUMN "idempotencyKey" SET NOT NULL;

-- CreateTable
CREATE TABLE "OperationalEventIngestKey" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "lookupId" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationalEventIngestKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OperationalEvent_workspaceId_source_idempotencyKey_key" ON "OperationalEvent"("workspaceId", "source", "idempotencyKey");

-- CreateIndex
CREATE INDEX "OperationalEvent_workspaceId_status_severity_occurredAt_idx" ON "OperationalEvent"("workspaceId", "status", "severity", "occurredAt");

-- CreateIndex
CREATE INDEX "OperationalEvent_workspaceId_source_occurredAt_idx" ON "OperationalEvent"("workspaceId", "source", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "OperationalEventIngestKey_lookupId_key" ON "OperationalEventIngestKey"("lookupId");

-- CreateIndex
CREATE INDEX "OperationalEventIngestKey_workspaceId_source_isActive_idx" ON "OperationalEventIngestKey"("workspaceId", "source", "isActive");

-- CreateIndex
CREATE INDEX "OperationalEventIngestKey_workspaceId_createdAt_idx" ON "OperationalEventIngestKey"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "OperationalEventIngestKey_createdByUserId_idx" ON "OperationalEventIngestKey"("createdByUserId");

-- AddForeignKey
ALTER TABLE "OperationalEventIngestKey" ADD CONSTRAINT "OperationalEventIngestKey_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalEventIngestKey" ADD CONSTRAINT "OperationalEventIngestKey_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
