-- AlterEnum
ALTER TYPE "TransferSource" ADD VALUE 'Bot';

-- AlterTable
ALTER TABLE "news" ADD COLUMN     "sourceId" VARCHAR(64);

-- AlterTable
ALTER TABLE "transfers" ADD COLUMN     "sourceId" VARCHAR(64);

-- CreateIndex
CREATE UNIQUE INDEX "news_sourceId_key" ON "news"("sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "transfers_sourceId_key" ON "transfers"("sourceId");
