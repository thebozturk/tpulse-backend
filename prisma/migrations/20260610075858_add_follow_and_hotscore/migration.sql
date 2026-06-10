-- AlterTable
ALTER TABLE "post" ADD COLUMN     "hotScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "scoreUpdatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "follow" (
    "id" UUID NOT NULL,
    "followerId" UUID NOT NULL,
    "followingId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "follow_followerId_idx" ON "follow"("followerId");

-- CreateIndex
CREATE INDEX "follow_followingId_idx" ON "follow"("followingId");

-- CreateIndex
CREATE UNIQUE INDEX "follow_followerId_followingId_key" ON "follow"("followerId", "followingId");

-- CreateIndex
CREATE INDEX "post_hotScore_idx" ON "post"("hotScore" DESC);

-- AddForeignKey
ALTER TABLE "follow" ADD CONSTRAINT "follow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow" ADD CONSTRAINT "follow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
