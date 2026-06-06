-- DropIndex
DROP INDEX "league_name_trgm";

-- DropIndex
DROP INDEX "player_first_trgm";

-- DropIndex
DROP INDEX "player_last_trgm";

-- DropIndex
DROP INDEX "team_name_trgm";

-- AddForeignKey
ALTER TABLE "post" ADD CONSTRAINT "post_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post" ADD CONSTRAINT "post_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post" ADD CONSTRAINT "post_fromTeamId_fkey" FOREIGN KEY ("fromTeamId") REFERENCES "team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post" ADD CONSTRAINT "post_toTeamId_fkey" FOREIGN KEY ("toTeamId") REFERENCES "team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
