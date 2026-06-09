-- Aksan/Türkçe karakter normalize search (Özil↔Ozil, Şahin↔Sahin, Gündoğan↔Gundogan).
-- unaccent + lower ile hem ç,ş,ğ,ü,ö,ı hem İ/I/ı/i tek forma iner; trgm index normalize ifade üzerinde.

CREATE EXTENSION IF NOT EXISTS unaccent;

-- unaccent STABLE'dır (dictionary'ye bağlı); index'lenebilmesi için IMMUTABLE wrapper şart.
-- Dictionary regclass'ı explicit verince ('unaccent') güvenle IMMUTABLE işaretlenir.
CREATE OR REPLACE FUNCTION f_unaccent(text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
AS $func$
  SELECT unaccent('unaccent', $1)
$func$;

-- Eski ham (case/aksan duyarlı) trgm index'lerini, normalize ifade üzerindekilerle değiştir.
DROP INDEX IF EXISTS "team_name_trgm";
DROP INDEX IF EXISTS "league_name_trgm";
DROP INDEX IF EXISTS "player_first_trgm";
DROP INDEX IF EXISTS "player_last_trgm";
DROP INDEX IF EXISTS "player_full_trgm";

CREATE INDEX IF NOT EXISTS "team_name_trgm" ON "team"
  USING gin (f_unaccent(lower(name)) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "league_name_trgm" ON "league"
  USING gin (f_unaccent(lower(name)) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "player_first_trgm" ON "player"
  USING gin (f_unaccent(lower("firstName")) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "player_last_trgm" ON "player"
  USING gin (f_unaccent(lower("lastName")) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "player_full_trgm" ON "player"
  USING gin (f_unaccent(lower("firstName" || ' ' || "lastName")) gin_trgm_ops);
