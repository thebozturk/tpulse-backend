-- CreateTable
CREATE TABLE "player_statistic" (
    "id" UUID NOT NULL,
    "playerId" UUID NOT NULL,
    "leagueId" UUID,
    "teamId" UUID,
    "leagueExternalId" INTEGER NOT NULL,
    "season" SMALLINT NOT NULL,
    "appearances" SMALLINT,
    "lineups" SMALLINT,
    "minutes" INTEGER,
    "rating" DECIMAL(4,2),
    "captain" BOOLEAN NOT NULL DEFAULT false,
    "goalsTotal" SMALLINT,
    "goalsConceded" SMALLINT,
    "goalsAssists" SMALLINT,
    "goalsSaves" SMALLINT,
    "shotsTotal" SMALLINT,
    "shotsOn" SMALLINT,
    "passesTotal" INTEGER,
    "passesKey" SMALLINT,
    "passesAccuracy" SMALLINT,
    "tacklesTotal" SMALLINT,
    "tacklesBlocks" SMALLINT,
    "tacklesInterceptions" SMALLINT,
    "duelsTotal" SMALLINT,
    "duelsWon" SMALLINT,
    "dribblesAttempts" SMALLINT,
    "dribblesSuccess" SMALLINT,
    "foulsDrawn" SMALLINT,
    "foulsCommitted" SMALLINT,
    "cardsYellow" SMALLINT,
    "cardsYellowRed" SMALLINT,
    "cardsRed" SMALLINT,
    "penaltyWon" SMALLINT,
    "penaltyCommitted" SMALLINT,
    "penaltyScored" SMALLINT,
    "penaltyMissed" SMALLINT,
    "penaltySaved" SMALLINT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ,

    CONSTRAINT "player_statistic_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "player_statistic_playerId_idx" ON "player_statistic"("playerId");

-- CreateIndex
CREATE INDEX "player_statistic_leagueId_season_idx" ON "player_statistic"("leagueId", "season");

-- CreateIndex
CREATE UNIQUE INDEX "player_statistic_playerId_leagueExternalId_season_key" ON "player_statistic"("playerId", "leagueExternalId", "season");

-- AddForeignKey
ALTER TABLE "player_statistic" ADD CONSTRAINT "player_statistic_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_statistic" ADD CONSTRAINT "player_statistic_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "league"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_statistic" ADD CONSTRAINT "player_statistic_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
