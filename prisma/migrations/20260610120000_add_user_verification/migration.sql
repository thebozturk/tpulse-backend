-- CreateEnum
CREATE TYPE "VerificationType" AS ENUM ('Blue', 'Gold');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "verificationType" "VerificationType",
ADD COLUMN     "verifiedAt" TIMESTAMPTZ;
