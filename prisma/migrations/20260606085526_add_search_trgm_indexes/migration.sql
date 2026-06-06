-- pg_trgm GIN index'leri (fuzzy search performansı — bot kullanır)
CREATE INDEX IF NOT EXISTS "team_name_trgm" ON "team" USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "league_name_trgm" ON "league" USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "player_first_trgm" ON "player" USING gin ("firstName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "player_last_trgm" ON "player" USING gin ("lastName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "player_full_trgm" ON "player" USING gin (("firstName" || ' ' || "lastName") gin_trgm_ops);
