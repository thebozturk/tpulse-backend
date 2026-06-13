-- Haber başlığı için aksan-duyarsız fuzzy arama index'i (f_unaccent + pg_trgm).
-- news.getAll search yolu f_unaccent(lower(title)) LIKE ... ile eşleştiği için
-- bu normalize ifade üzerinde GIN trgm index gerekir.
-- f_unaccent + pg_trgm + unaccent extension'ları önceki migration'larda kuruldu.
CREATE INDEX IF NOT EXISTS "news_title_trgm" ON "news"
  USING gin (f_unaccent(lower(title)) gin_trgm_ops);
