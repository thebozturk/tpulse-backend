---
name: postgres-fulltext
keywords: "full-text, tsvector, tsquery, search, ranking"
description: "Postgres full-text search — tsvector, tsquery, ranking"
---

# Full-Text Search

Postgres native FTS — Elasticsearch alternative for many use cases.

## tsvector / tsquery

### tsvector
Document → searchable representation (lemmatized + position):
```sql
SELECT to_tsvector('turkish', 'Bir SQL veritabanı yazılımıdır');
-- 'sql':2 'veritaban':3 'yazılım':4
```

### tsquery
Query parse:
```sql
SELECT to_tsquery('turkish', 'sql & yazılım');   -- AND
SELECT to_tsquery('turkish', 'sql | mongo');     -- OR
SELECT to_tsquery('turkish', '!sql');            -- NOT
SELECT to_tsquery('turkish', 'sql <-> veritabanı');  -- proximity
```

## plainto_tsquery / websearch_to_tsquery

User input için safer:

```sql
plainto_tsquery('turkish', 'sql veritabanı')
-- 'sql' & 'veritaban'

websearch_to_tsquery('turkish', '"exact phrase" -excluded')
-- exact phrase + NOT excluded
```

`websearch_to_tsquery` — Google-style: quotes, OR, minus.

## Schema setup

### Simple — generated column (Postgres 12+)
```sql
ALTER TABLE posts ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('turkish', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('turkish', coalesce(content, '')), 'B')
  ) STORED;

CREATE INDEX posts_search_idx ON posts USING GIN(search_vector);
```

setweight — A (highest), B, C, D. Title in A, content in B.

### Trigger-based (any Postgres version)
```sql
ALTER TABLE posts ADD COLUMN search_vector tsvector;

CREATE FUNCTION posts_search_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('turkish', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('turkish', coalesce(NEW.content, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER posts_search_trigger
  BEFORE INSERT OR UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION posts_search_update();

CREATE INDEX posts_search_idx ON posts USING GIN(search_vector);
```

### Prisma migration
```bash
npx prisma migrate dev --create-only --name add_post_search
# Edit migration.sql, add ALTER TABLE + CREATE INDEX
npx prisma migrate dev
```

## Query

```typescript
const query = "next.js prisma";

const posts = await prisma.$queryRaw<Post[]>`
  SELECT *,
    ts_rank(search_vector, websearch_to_tsquery('turkish', ${query})) AS rank
  FROM "Post"
  WHERE search_vector @@ websearch_to_tsquery('turkish', ${query})
  ORDER BY rank DESC
  LIMIT 20
`;
```

`@@` — tsvector matches tsquery.

## Ranking

```sql
ts_rank(vector, query)              -- frequency-based
ts_rank_cd(vector, query)           -- proximity-based (better for short docs)
```

```sql
SELECT *, ts_rank(search_vector, q) AS rank
FROM posts, websearch_to_tsquery('turkish', 'react hooks') q
WHERE search_vector @@ q
ORDER BY rank DESC;
```

## Snippets / highlights

```sql
SELECT
  ts_headline(
    'turkish',
    content,
    websearch_to_tsquery('turkish', 'react hooks'),
    'StartSel=<mark>, StopSel=</mark>, MaxFragments=2, MaxWords=20, MinWords=10'
  ) AS snippet
FROM posts
WHERE search_vector @@ websearch_to_tsquery('turkish', 'react hooks');
```

User'a: `... işte <mark>react hooks</mark> kullanımı ...`

## Multi-language

### Per-row language
```sql
ALTER TABLE posts ADD COLUMN language regconfig DEFAULT 'turkish';

-- Trigger
CREATE FUNCTION posts_search_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector(NEW.language::regconfig, coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector(NEW.language::regconfig, coalesce(NEW.content, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

```typescript
await prisma.$executeRaw`
  INSERT INTO posts (title, content, language)
  VALUES (${title}, ${content}, ${language}::regconfig)
`;
```

### Available languages
```sql
SELECT cfgname FROM pg_ts_config;
-- english, turkish, german, french, spanish, ... + simple
```

`simple` — no stemming (just tokenize).

## Prisma 5+ native FTS

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["fullTextSearch", "fullTextIndex"]
}

model Post {
  id      String @id @default(cuid())
  title   String
  content String

  @@fulltext([title, content])
}
```

Query (limited):
```typescript
await prisma.post.findMany({
  where: {
    OR: [
      { title: { search: "react & hooks" } },
      { content: { search: "react & hooks" } },
    ],
  },
});
```

⚠️ Limitations:
- Single language config (no per-row)
- No ts_rank ordering
- No headline / snippet
- Postgres adapter still in preview

For complex FTS → raw SQL recommended.

## Use cases

### Blog search
Title (weight A) + content (weight B) + tags (weight C).

### E-commerce product search
Name (A) + description (B) + brand (B) + tags (C).

### Document management
Filename (A) + content (B) + metadata.title (A).

## Performance

### When FTS adequate
- < 10M docs
- Simple queries (AND, OR, phrase)
- Same DB (no separate infra)
- Postgres team comfort

### When Elasticsearch
- > 100M docs
- Complex queries (fuzzy, aggregations, autocomplete)
- High-throughput search (>1000 qps)
- Real-time analytics

### Trgm extension (fuzzy / typo)

```sql
CREATE EXTENSION pg_trgm;

-- Trigram similarity
SELECT * FROM users WHERE name % 'jhon';     -- 'John' matches (typo)
SELECT * FROM users ORDER BY name <-> 'jhon' LIMIT 5;   -- closest matches

-- GIN trgm index (for LIKE '%pattern%')
CREATE INDEX users_name_trgm_idx ON users USING GIN(name gin_trgm_ops);
```

FTS + trgm combined: FTS for relevance, trgm for typo tolerance.

## Anti-pattern'ler

### LIKE for full-text
```sql
WHERE content LIKE '%react%'   -- ❌ no index, slow
```

→ tsvector + GIN.

### Plain ts_query without sanitize
```typescript
prisma.$queryRaw`... WHERE vec @@ to_tsquery('turkish', ${userInput})`;
// User input "foo & bar" → query parses
// User input "foo bar" → ERROR (invalid tsquery syntax)
```

→ `plainto_tsquery` / `websearch_to_tsquery`.

### Missing GIN index
search_vector column var ama GIN yok → seq scan.

### Wrong language
Turkish content English stemmer ile → "yazılım" → "yazılım" (no stem). Türkçe için `'turkish'` config.

### Generated column without index
```sql
ALTER TABLE ... GENERATED ALWAYS AS (...) STORED;
-- but no GIN index → no benefit
```

## Aksiyon

1. tsvector column + GIN index + setweight
2. Generated column (Postgres 12+) > trigger pattern
3. Query: `websearch_to_tsquery` user input için
4. Ranking: `ts_rank` veya `ts_rank_cd`
5. Snippets: `ts_headline` UI'da highlight
6. Multi-language: per-row `language regconfig` column
7. Trgm extension fuzzy / typo tolerance
8. Prisma `@@fulltext` simple use case için, complex'te raw SQL
