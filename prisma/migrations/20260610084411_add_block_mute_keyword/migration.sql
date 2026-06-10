-- CreateTable
CREATE TABLE "user_block" (
    "id" UUID NOT NULL,
    "blockerId" UUID NOT NULL,
    "blockedId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_mute" (
    "id" UUID NOT NULL,
    "muterId" UUID NOT NULL,
    "mutedId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_mute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "muted_keyword" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "keyword" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "muted_keyword_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_block_blockerId_idx" ON "user_block"("blockerId");

-- CreateIndex
CREATE UNIQUE INDEX "user_block_blockerId_blockedId_key" ON "user_block"("blockerId", "blockedId");

-- CreateIndex
CREATE INDEX "user_mute_muterId_idx" ON "user_mute"("muterId");

-- CreateIndex
CREATE UNIQUE INDEX "user_mute_muterId_mutedId_key" ON "user_mute"("muterId", "mutedId");

-- CreateIndex
CREATE INDEX "muted_keyword_userId_idx" ON "muted_keyword"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "muted_keyword_userId_keyword_key" ON "muted_keyword"("userId", "keyword");

-- AddForeignKey
ALTER TABLE "user_block" ADD CONSTRAINT "user_block_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_block" ADD CONSTRAINT "user_block_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_mute" ADD CONSTRAINT "user_mute_muterId_fkey" FOREIGN KEY ("muterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_mute" ADD CONSTRAINT "user_mute_mutedId_fkey" FOREIGN KEY ("mutedId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "muted_keyword" ADD CONSTRAINT "muted_keyword_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
