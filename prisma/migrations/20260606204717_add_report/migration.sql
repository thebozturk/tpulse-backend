-- CreateEnum
CREATE TYPE "ReportTargetType" AS ENUM ('Post', 'Comment', 'TransferComment', 'User');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('Spam', 'Hate', 'Harassment', 'Other');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('Pending', 'Reviewed', 'Actioned', 'Dismissed');

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL,
    "reporterUserId" UUID NOT NULL,
    "targetType" "ReportTargetType" NOT NULL,
    "targetId" UUID NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "note" VARCHAR(1000),
    "status" "ReportStatus" NOT NULL DEFAULT 'Pending',
    "reviewedByUserId" UUID,
    "reviewedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reports_status_createdAt_idx" ON "reports"("status", "createdAt");

-- CreateIndex
CREATE INDEX "reports_targetType_targetId_idx" ON "reports"("targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "reports_reporterUserId_targetType_targetId_key" ON "reports"("reporterUserId", "targetType", "targetId");
