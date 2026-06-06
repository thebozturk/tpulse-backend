-- AlterTable
ALTER TABLE "users" ADD COLUMN     "banReason" VARCHAR(500),
ADD COLUMN     "bannedAt" TIMESTAMPTZ;
