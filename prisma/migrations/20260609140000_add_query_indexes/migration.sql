-- Sık okunan list/search yollarını destekleyen index'ler.
-- Transfer: tüm public sorgular isRumour(+isDeleted soft-delete) ile filtreler;
-- composite'ler bu filtre + en yaygın ikinci kolon (createdAt sort / team / player) içindir.
-- Diğerleri FK kolonlarına (Postgres FK'ya otomatik index açmaz) okuma index'i ekler.

-- Transfer
CREATE INDEX IF NOT EXISTS "transfers_isRumour_isDeleted_createdAt_idx" ON "transfers"("isRumour", "isDeleted", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "transfers_isRumour_isDeleted_playerId_idx" ON "transfers"("isRumour", "isDeleted", "playerId");
CREATE INDEX IF NOT EXISTS "transfers_isRumour_isDeleted_toTeamId_idx" ON "transfers"("isRumour", "isDeleted", "toTeamId");
CREATE INDEX IF NOT EXISTS "transfers_isRumour_isDeleted_fromTeamId_idx" ON "transfers"("isRumour", "isDeleted", "fromTeamId");
CREATE INDEX IF NOT EXISTS "transfers_createdByUserId_idx" ON "transfers"("createdByUserId");

-- Team
CREATE INDEX IF NOT EXISTS "team_leagueId_idx" ON "team"("leagueId");

-- Player
CREATE INDEX IF NOT EXISTS "player_teamId_idx" ON "player"("teamId");
CREATE INDEX IF NOT EXISTS "player_nationality_idx" ON "player"("nationality");
CREATE INDEX IF NOT EXISTS "player_isFree_idx" ON "player"("isFree");

-- Post
CREATE INDEX IF NOT EXISTS "post_ownerId_idx" ON "post"("ownerId");
CREATE INDEX IF NOT EXISTS "post_playerId_idx" ON "post"("playerId");
CREATE INDEX IF NOT EXISTS "post_teamId_idx" ON "post"("teamId");

-- Comment
CREATE INDEX IF NOT EXISTS "comment_postId_idx" ON "comment"("postId");
CREATE INDEX IF NOT EXISTS "comment_parentId_idx" ON "comment"("parentId");

-- TransferComment
CREATE INDEX IF NOT EXISTS "transfer_comment_transferId_idx" ON "transfer_comment"("transferId");
CREATE INDEX IF NOT EXISTS "transfer_comment_parentId_idx" ON "transfer_comment"("parentId");
