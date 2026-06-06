-- CreateTable
CREATE TABLE "broadcast_messages" (
    "id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" VARCHAR(500) NOT NULL,
    "target" VARCHAR(40) NOT NULL DEFAULT 'all',
    "status" VARCHAR(20) NOT NULL DEFAULT 'Queued',
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "broadcast_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "broadcast_messages_createdAt_idx" ON "broadcast_messages"("createdAt");
