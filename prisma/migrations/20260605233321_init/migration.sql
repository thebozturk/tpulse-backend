-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('Active', 'Inactive', 'Banned', 'Suspended');

-- CreateEnum
CREATE TYPE "TransferSource" AS ENUM ('Manual', 'ApiSports');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "email" VARCHAR(256) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nickname" VARCHAR(50) NOT NULL,
    "profilePic" VARCHAR(500),
    "isMailConfirm" BOOLEAN NOT NULL DEFAULT false,
    "status" "UserStatus" NOT NULL DEFAULT 'Active',
    "favouriteTeam" VARCHAR(100),
    "reputationScore" INTEGER NOT NULL DEFAULT 0,
    "role" VARCHAR(20) NOT NULL DEFAULT 'User',
    "googleId" VARCHAR(256),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "league" (
    "id" UUID NOT NULL,
    "externalId" INTEGER,
    "name" VARCHAR(30) NOT NULL,
    "country" VARCHAR(30) NOT NULL,
    "countryLogo" TEXT NOT NULL,
    "leagueLogo" TEXT NOT NULL,
    "logoLockedByAdmin" BOOLEAN NOT NULL DEFAULT false,
    "leagueLogoSourceUrl" TEXT,
    "leagueCode" VARCHAR(10),

    CONSTRAINT "league_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team" (
    "id" UUID NOT NULL,
    "externalId" INTEGER,
    "name" VARCHAR(50) NOT NULL,
    "logo" TEXT,
    "logoLockedByAdmin" BOOLEAN NOT NULL DEFAULT false,
    "logoSourceUrl" TEXT,
    "founded" INTEGER,
    "venueName" VARCHAR(100),
    "venueCity" VARCHAR(100),
    "venueCapacity" INTEGER,
    "leagueId" UUID NOT NULL,

    CONSTRAINT "team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "position" (
    "id" UUID NOT NULL,
    "codeEn" VARCHAR(5) NOT NULL,
    "nameEn" VARCHAR(16) NOT NULL,
    "codeTr" VARCHAR(5) NOT NULL,
    "nameTr" VARCHAR(16) NOT NULL,

    CONSTRAINT "position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player" (
    "id" UUID NOT NULL,
    "externalId" INTEGER,
    "firstName" VARCHAR(32) NOT NULL,
    "lastName" VARCHAR(32) NOT NULL,
    "nationality" VARCHAR(32) NOT NULL,
    "birthDate" DATE,
    "height" SMALLINT,
    "weight" SMALLINT,
    "photo" TEXT,
    "birthPlace" VARCHAR(32),
    "birthCountry" VARCHAR(32),
    "isFree" BOOLEAN NOT NULL DEFAULT false,
    "photoLockedByAdmin" BOOLEAN NOT NULL DEFAULT false,
    "photoSourceUrl" TEXT,
    "teamId" UUID NOT NULL,
    "positionId" UUID,

    CONSTRAINT "player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfers" (
    "id" UUID NOT NULL,
    "playerId" UUID NOT NULL,
    "fromTeamId" UUID NOT NULL,
    "toTeamId" UUID NOT NULL,
    "transferDate" TIMESTAMPTZ NOT NULL,
    "feeAmount" DECIMAL(18,2) NOT NULL,
    "feeCurrency" VARCHAR(10) NOT NULL,
    "createdByUserId" UUID,
    "isRumour" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "source" "TransferSource" NOT NULL DEFAULT 'Manual',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ,

    CONSTRAINT "transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "postType" SMALLINT NOT NULL,
    "playerId" UUID,
    "teamId" UUID,
    "fromTeamId" UUID,
    "toTeamId" UUID,
    "likeCount" SMALLINT NOT NULL DEFAULT 0,
    "isVotingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "agreeCount" INTEGER NOT NULL DEFAULT 0,
    "disagreeCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "createdAtUtc" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_like" (
    "id" UUID NOT NULL,
    "postId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAtUtc" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_like_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_vote" (
    "id" UUID NOT NULL,
    "postId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "choice" SMALLINT NOT NULL,
    "createdAtUtc" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comment" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "content" TEXT,
    "postId" UUID NOT NULL,
    "parentId" UUID,
    "likeCount" SMALLINT NOT NULL DEFAULT 0,
    "createdAtUtc" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comment_like" (
    "id" UUID NOT NULL,
    "commentId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAtUtc" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comment_like_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfer_comment" (
    "id" UUID NOT NULL,
    "transferId" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "content" TEXT,
    "parentId" UUID,
    "likeCount" SMALLINT NOT NULL DEFAULT 0,
    "createdAtUtc" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transfer_comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfer_comment_like" (
    "id" UUID NOT NULL,
    "transferCommentId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAtUtc" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transfer_comment_like_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news" (
    "news_id" UUID NOT NULL,
    "publishDate" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "playerId" UUID,
    "fromTeamId" UUID,
    "toTeamId" UUID,
    "slug" VARCHAR(256) NOT NULL,
    "imageUrl" TEXT,
    "sourceName" VARCHAR(128),
    "sourceUrl" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT,

    CONSTRAINT "news_pkey" PRIMARY KEY ("news_id")
);

-- CreateTable
CREATE TABLE "currency_rates" (
    "id" UUID NOT NULL,
    "currencyCode" VARCHAR(10) NOT NULL,
    "baseCurrencyCode" VARCHAR(10) NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "rateDate" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "currency_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "eventType" SMALLINT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" VARCHAR(500) NOT NULL,
    "transferId" UUID,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preference" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "eventType" SMALLINT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "notification_preference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_token" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" VARCHAR(128) NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "usedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "token" VARCHAR(256) NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMPTZ,
    "replacedByToken" VARCHAR(256),

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_message" (
    "id" UUID NOT NULL,
    "eventType" VARCHAR(256) NOT NULL,
    "payload" TEXT NOT NULL,
    "routingKey" VARCHAR(256) NOT NULL,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAtUtc" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAtUtc" TIMESTAMPTZ,
    "lastError" TEXT,

    CONSTRAINT "outbox_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_run" (
    "id" UUID NOT NULL,
    "startedAt" TIMESTAMPTZ NOT NULL,
    "completedAt" TIMESTAMPTZ NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "status" SMALLINT NOT NULL,
    "leaguesProcessed" INTEGER NOT NULL,
    "leaguesInserted" INTEGER NOT NULL,
    "leaguesUpdated" INTEGER NOT NULL,
    "teamsInserted" INTEGER NOT NULL,
    "teamsUpdated" INTEGER NOT NULL,
    "playersInserted" INTEGER NOT NULL,
    "playersUpdated" INTEGER NOT NULL,
    "positionsCreated" INTEGER NOT NULL,
    "transfersCreated" INTEGER NOT NULL,
    "playersMarkedFree" INTEGER NOT NULL,
    "errorCount" INTEGER NOT NULL,
    "errors" TEXT,
    "fatalError" TEXT,

    CONSTRAINT "sync_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_favourite" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" SMALLINT NOT NULL,
    "targetId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_favourite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfer_periods" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "periodType" VARCHAR(40),
    "startDate" TIMESTAMPTZ NOT NULL,
    "endDate" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transfer_periods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "league_externalId_key" ON "league"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "league_name_key" ON "league"("name");

-- CreateIndex
CREATE UNIQUE INDEX "league_leagueCode_key" ON "league"("leagueCode");

-- CreateIndex
CREATE UNIQUE INDEX "team_externalId_key" ON "team"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "team_name_key" ON "team"("name");

-- CreateIndex
CREATE UNIQUE INDEX "player_externalId_key" ON "player"("externalId");

-- CreateIndex
CREATE INDEX "transfers_playerId_fromTeamId_toTeamId_transferDate_idx" ON "transfers"("playerId", "fromTeamId", "toTeamId", "transferDate");

-- CreateIndex
CREATE INDEX "transfers_transferDate_idx" ON "transfers"("transferDate");

-- CreateIndex
CREATE INDEX "transfers_feeAmount_idx" ON "transfers"("feeAmount");

-- CreateIndex
CREATE INDEX "post_createdAtUtc_id_idx" ON "post"("createdAtUtc", "id");

-- CreateIndex
CREATE UNIQUE INDEX "post_like_postId_userId_key" ON "post_like"("postId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "post_vote_postId_userId_key" ON "post_vote"("postId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "comment_like_commentId_userId_key" ON "comment_like"("commentId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "transfer_comment_like_transferCommentId_userId_key" ON "transfer_comment_like"("transferCommentId", "userId");

-- CreateIndex
CREATE INDEX "news_playerId_idx" ON "news"("playerId");

-- CreateIndex
CREATE INDEX "news_toTeamId_idx" ON "news"("toTeamId");

-- CreateIndex
CREATE INDEX "news_fromTeamId_idx" ON "news"("fromTeamId");

-- CreateIndex
CREATE INDEX "news_sourceName_idx" ON "news"("sourceName");

-- CreateIndex
CREATE INDEX "news_publishDate_idx" ON "news"("publishDate");

-- CreateIndex
CREATE INDEX "currency_rates_rateDate_idx" ON "currency_rates"("rateDate");

-- CreateIndex
CREATE UNIQUE INDEX "currency_rates_currencyCode_baseCurrencyCode_rateDate_key" ON "currency_rates"("currencyCode", "baseCurrencyCode", "rateDate");

-- CreateIndex
CREATE INDEX "notification_userId_createdAt_idx" ON "notification"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "notification_userId_transferId_eventType_key" ON "notification"("userId", "transferId", "eventType");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preference_userId_eventType_key" ON "notification_preference"("userId", "eventType");

-- CreateIndex
CREATE INDEX "password_reset_token_tokenHash_idx" ON "password_reset_token"("tokenHash");

-- CreateIndex
CREATE INDEX "password_reset_token_userId_idx" ON "password_reset_token"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "outbox_message_processedAtUtc_createdAtUtc_idx" ON "outbox_message"("processedAtUtc", "createdAtUtc");

-- CreateIndex
CREATE INDEX "sync_run_startedAt_idx" ON "sync_run"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_favourite_userId_type_targetId_key" ON "user_favourite"("userId", "type", "targetId");

-- CreateIndex
CREATE INDEX "transfer_periods_startDate_endDate_idx" ON "transfer_periods"("startDate", "endDate");

-- AddForeignKey
ALTER TABLE "team" ADD CONSTRAINT "team_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "league"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player" ADD CONSTRAINT "player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player" ADD CONSTRAINT "player_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_fromTeamId_fkey" FOREIGN KEY ("fromTeamId") REFERENCES "team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_toTeamId_fkey" FOREIGN KEY ("toTeamId") REFERENCES "team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post" ADD CONSTRAINT "post_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_like" ADD CONSTRAINT "post_like_postId_fkey" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_like" ADD CONSTRAINT "post_like_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_vote" ADD CONSTRAINT "post_vote_postId_fkey" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_vote" ADD CONSTRAINT "post_vote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment" ADD CONSTRAINT "comment_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment" ADD CONSTRAINT "comment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment" ADD CONSTRAINT "comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_like" ADD CONSTRAINT "comment_like_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_like" ADD CONSTRAINT "comment_like_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_comment" ADD CONSTRAINT "transfer_comment_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "transfers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_comment" ADD CONSTRAINT "transfer_comment_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_comment" ADD CONSTRAINT "transfer_comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "transfer_comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_comment_like" ADD CONSTRAINT "transfer_comment_like_transferCommentId_fkey" FOREIGN KEY ("transferCommentId") REFERENCES "transfer_comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_comment_like" ADD CONSTRAINT "transfer_comment_like_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Faz 1: pg_trgm extension (Faz 3 fuzzy search için) ───────────────
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ─── Faz 1: Prisma'nın ifade edemediği check constraint'ler ───────────
-- Post: PostType'a göre FK doluluk (docs/01)
ALTER TABLE "post" ADD CONSTRAINT "post_type_shape_chk" CHECK (
  ("postType" = 1 AND "playerId" IS NOT NULL AND "fromTeamId" IS NOT NULL AND "toTeamId" IS NOT NULL AND "teamId" IS NULL) OR
  ("postType" = 2 AND "teamId" IS NOT NULL AND "playerId" IS NULL AND "fromTeamId" IS NULL AND "toTeamId" IS NULL) OR
  ("postType" = 3 AND "playerId" IS NOT NULL AND "teamId" IS NULL AND "fromTeamId" IS NULL AND "toTeamId" IS NULL) OR
  ("playerId" IS NULL AND "teamId" IS NULL AND "fromTeamId" IS NULL AND "toTeamId" IS NULL)
);

-- PostVote: choice IN (1,2)
ALTER TABLE "post_vote" ADD CONSTRAINT "post_vote_choice_chk" CHECK ("choice" IN (1, 2));

-- TransferPeriod: endDate >= startDate
ALTER TABLE "transfer_periods" ADD CONSTRAINT "transfer_period_dates_chk" CHECK ("endDate" >= "startDate");
