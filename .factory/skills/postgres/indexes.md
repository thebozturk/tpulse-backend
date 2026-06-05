---
name: postgres-indexes
keywords: "index, btree, gin, partial, composite, expression"
description: "Postgres index types — B-tree, GIN, partial, expression"
---

# Postgres Indexes

## B-tree (default)

Equality + range:
```sql
CREATE INDEX users_email_idx ON users(email);
```

Prisma:
```prisma
@@index([email])
```

Best for: `=, <, >, BETWEEN, IN, IS NULL`.

### Composite (multi-column)
```sql
CREATE INDEX posts_org_created_idx ON posts(org_id, created_at DESC);
```

```prisma
@@index([orgId, createdAt(sort: Desc)])
```

**Order matters** — left-to-right prefix:
- ✓ `WHERE org_id = X` — uses index
- ✓ `WHERE org_id = X AND created_at > Y` — uses index
- ✗ `WHERE created_at > Y` — NO index (left column missing)

### Index covering (INCLUDE)
Postgres 11+:
```sql
CREATE INDEX posts_idx ON posts(org_id) INCLUDE (title, status);
```

Index'in sayfaları title + status'u da içerir → table'a gitmez ("index-only scan").

## GIN (Generalized Inverted)

Multi-value column'lar için: array, JSONB, full-text.

### Array
```sql
CREATE INDEX posts_tags_idx ON posts USING GIN(tags);
```

```typescript
// Array ops
await prisma.$queryRaw`SELECT * FROM posts WHERE tags && ARRAY['typescript']`;
// && — overlap, @> — contains, <@ — contained-by
```

### JSONB
```sql
-- Path ops (small payload, frequent path queries)
CREATE INDEX events_payload_idx ON events USING GIN(payload jsonb_path_ops);

-- Full ops (any operator, larger index)
CREATE INDEX events_payload_idx ON events USING GIN(payload);
```

```typescript
// Prisma JSONB query
await prisma.event.findMany({
  where: { payload: { path: ["userId"], equals: "abc" } },
});
```

### Full-text
Bkz. full-text-search.md.

## Partial index

WHERE clause ile bazı row'ları index dışı bırak:

```sql
-- Sadece active record'lar için
CREATE INDEX active_users_idx ON users(email) WHERE deleted_at IS NULL;

-- Sadece pending order'lar
CREATE INDEX pending_orders_idx ON orders(user_id, created_at)
  WHERE status = 'PENDING';
```

Use case: "%99 deleted=false, query her zaman deleted=false ile" → partial index 100x küçük.

## Expression index

Function üzerinden:

```sql
-- Lowercased email lookup
CREATE INDEX users_email_lower_idx ON users(LOWER(email));

-- Query
SELECT * FROM users WHERE LOWER(email) = LOWER('User@Example.com');
```

```sql
-- JSONB field
CREATE INDEX events_user_idx ON events((payload->>'userId'));
```

## Unique constraint vs unique index

```sql
-- Constraint
ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE(email);

-- Index
CREATE UNIQUE INDEX users_email_idx ON users(email);
```

Same effect — Postgres constraint = unique index under the hood.

Prisma:
```prisma
email String @unique   // creates unique index
```

## When to NOT index

### Small tables (<1000 rows)
Sequential scan zaten hızlı. Index overhead gereksiz.

### Heavily-written tables, rarely-read columns
Her INSERT/UPDATE index'i de update eder. Write-heavy table'da read-rarely column index kötü.

### Low cardinality columns alone
```sql
-- ❌ Sadece is_active (true/false) — selectivity düşük
CREATE INDEX users_active_idx ON users(is_active);

-- ✓ Composite ile high-cardinality başta
CREATE INDEX users_role_active_idx ON users(role, is_active);
```

## EXPLAIN ANALYZE

Index kullanılıyor mu doğrula:

```sql
EXPLAIN ANALYZE SELECT * FROM posts WHERE author_id = 'abc';
```

```
Seq Scan on posts (cost=...)              ← BAD: full table scan
Index Scan using posts_author_idx (cost=...)  ← GOOD
Bitmap Heap Scan on posts (cost=...)
  -> Bitmap Index Scan on posts_author_idx  ← GOOD: many results
```

## Index maintenance

### REINDEX
Bloated index (frequent updates):
```sql
REINDEX INDEX CONCURRENTLY users_email_idx;
```

`CONCURRENTLY` — non-blocking (production-safe).

### Index size check
```sql
SELECT
  indexname,
  pg_size_pretty(pg_relation_size(indexname::regclass)) AS size
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexname::regclass) DESC
LIMIT 20;
```

Büyük index → review et, gerekli mi.

### Unused indexes
```sql
SELECT
  schemaname || '.' || relname AS table,
  indexrelname AS index,
  idx_scan AS scans
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;
```

`idx_scan = 0` → index hiç kullanılmamış. Drop kandidatı.

## Cost

Each index:
- Disk space (index size ~ table size if covering all rows)
- Write cost (INSERT/UPDATE/DELETE'de index update)
- Memory (working set)

Rule of thumb: **Production'da 5-10 index per table max.**

## Anti-pattern'ler

### Over-indexing
```prisma
@@index([email])
@@index([name])
@@index([email, name])         // covers single email + composite
@@index([role])
@@index([role, isActive])
@@index([createdAt])
@@index([updatedAt])
@@index([deletedAt])
// Write performance crashes
```

Slow query log'a bak, GERÇEK kullanım pattern'i indexle.

### Foreign key index unutma
Prisma + Postgres → FK auto-index DEĞİL.

```prisma
@@index([authorId])    // ZORUNLU, manuel
```

### LIKE 'prefix%' yerine `text_pattern_ops` kullanmama
```sql
-- Default B-tree LIKE 'pattern%' için optimize değil
-- Daha iyi:
CREATE INDEX users_email_pat_idx ON users(email text_pattern_ops);
SELECT * FROM users WHERE email LIKE 'admin%';   -- uses index now
```

### Composite index column order
Most-selective column ilk. Cardinality düşük (true/false) → composite'in sonunda.

## Aksiyon

1. Foreign key columns ZORUNLU `@@index`
2. Query pattern'ı dinleyerek composite index
3. JSONB path query → GIN index
4. Array column → GIN index
5. Full-text → GIN tsvector
6. Partial index "%99 same value" pattern'inde
7. EXPLAIN ANALYZE periodic
8. Unused index quarterly cleanup
9. >10 index/table = warning
