-- AddForeignKey
ALTER TABLE "news" ADD CONSTRAINT "news_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news" ADD CONSTRAINT "news_fromTeamId_fkey" FOREIGN KEY ("fromTeamId") REFERENCES "team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news" ADD CONSTRAINT "news_toTeamId_fkey" FOREIGN KEY ("toTeamId") REFERENCES "team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
