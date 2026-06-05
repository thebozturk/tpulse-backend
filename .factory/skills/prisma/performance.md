---
name: prisma-performance
keywords: "performance, N+1, connection pool, slow query, optimize"
description: "Performance — N+1, pool, query optimization, indexing"
---

# Prisma Performance

## N+1 prevention

Belirti: 1 list query → her item için 1 ek query.

```typescript
// ❌ N+1
const posts = await prisma.post.findMany();
for (const post of posts) {
  post.author = await prisma.user.findUnique({ where: { id: post.authorId } });
}
// 1 + N
```

### Fix 1: include
```typescript
const posts = await prisma.post.findMany({ include: { author: true } });
// 1 query (Prisma JOIN)
```

### Fix 2: select with relation
```typescript
const posts = await prisma.post.findMany({
  select: { id: true, title: true, author: { select: { id: true, name: true } } },
});
```

### Fix 3: batch (DataLoader pattern)
```typescript
// userIds list → batch fetch
const userIds = posts.map(p => p.authorId);
const users = await prisma.user.findMany({ where: { id: { in: userIds } } });
const userMap = new Map(users.map(u => [u.id, u]));
posts.forEach(p => p.author = userMap.get(p.authorId));
```

GraphQL/REST'te DataLoader gerekli. Plain REST'te `include` yeterli.

## Connection pool

### Default settings
```
DATABASE_URL="postgresql://...?connection_limit=N"
```

Default `num_cpus * 2 + 1`. Cloud serverless'ta override:

```bash
# Single instance — default OK
DATABASE_URL="...?connection_limit=10"

# Lambda/Vercel serverless — 1 connection per function instance
DATABASE_URL="...?connection_limit=1&pool_timeout=20"
```

### pgBouncer (production)
```bash
# Direct → pgBouncer → Postgres
DATABASE_URL="postgresql://user:pass@bouncer.acme.com:6432/db?pgbouncer=true&connection_limit=1"

# Migration için direct (pgBouncer transaction mode incompatible)
DIRECT_URL="postgresql://user:pass@db.acme.com:5432/db"
```

```prisma
datasource db {
  provider     = "postgresql"
  url          = env("DATABASE_URL")
  directUrl    = env("DIRECT_URL")    // migrations için
}
```

`pgbouncer=true` flag — Prisma transaction-mode aware.

### Monitor pool
```typescript
// Slow query log
this.$on("query", (e) => {
  if (e.duration > 100) {
    logger.warn(`Slow ${e.duration}ms: ${e.query}`);
  }
});
```

Postgres'te:
```sql
SELECT * FROM pg_stat_activity WHERE state != 'idle';
```

## Indexing

### Foreign keys
```prisma
model Post {
  authorId String
  author   User @relation(fields: [authorId], references: [id])

  @@index([authorId])    // ZORUNLU — Postgres FK auto-index yapmaz
}
```

### Composite (query pattern bazlı)
```typescript
// Query: filter by orgId + sort by createdAt
prisma.post.findMany({
  where: { orgId },
  orderBy: { createdAt: "desc" },
});
```

```prisma
@@index([orgId, createdAt(sort: Desc)])
```

### Partial index (Postgres)
Aktif kayıtlar büyük çoğunluk değilse:
```sql
-- Manuel migration
CREATE INDEX active_posts_idx ON "Post"("createdAt") WHERE "deletedAt" IS NULL;
```

### GIN (full-text, JSONB, array)
```sql
CREATE INDEX post_tags_idx ON "Post" USING GIN(tags);
CREATE INDEX event_payload_idx ON "Event" USING GIN(payload jsonb_path_ops);
```

### Index hint check
```bash
# EXPLAIN
EXPLAIN ANALYZE SELECT * FROM "Post" WHERE "authorId" = '...';
```

`Seq Scan` görüyorsan → index yok / kullanılmıyor.
`Index Scan` görüyorsan → OK.

## Query optimization

### select över include
```typescript
// ❌ All fields including large columns
include: { post: true }

// ✓ Only what you need
select: { post: { select: { id: true, title: true } } }
```

Büyük column (TEXT, JSONB) explicit select et.

### Conditional include
```typescript
const include = userIsAdmin ? { audit: true } : undefined;
prisma.post.findMany({ include });
```

### Aggregation > findMany + map
```typescript
// ❌
const posts = await prisma.post.findMany({ where: { authorId } });
const total = posts.reduce((sum, p) => sum + p.views, 0);

// ✓ DB-side
const stats = await prisma.post.aggregate({
  where: { authorId },
  _sum: { views: true },
});
```

### Batch updates
```typescript
// ❌ N updates
for (const id of ids) {
  await prisma.post.update({ where: { id }, data: { archived: true } });
}

// ✓ Single
await prisma.post.updateMany({
  where: { id: { in: ids } },
  data: { archived: true },
});
```

## Caching

### Application-level
```typescript
import { LRUCache } from "lru-cache";

const cache = new LRUCache<string, User>({ max: 1000, ttl: 60000 });

async function getUser(id: string) {
  if (cache.has(id)) return cache.get(id);
  const user = await prisma.user.findUnique({ where: { id } });
  if (user) cache.set(id, user);
  return user;
}
```

### Redis
```typescript
async function getUser(id: string) {
  const cached = await redis.get(`user:${id}`);
  if (cached) return JSON.parse(cached);
  const user = await prisma.user.findUnique({ where: { id } });
  if (user) await redis.set(`user:${id}`, JSON.stringify(user), "EX", 300);
  return user;
}
```

Invalidate update'te:
```typescript
async function updateUser(id: string, data: any) {
  const user = await prisma.user.update({ where: { id }, data });
  await redis.del(`user:${id}`);
  return user;
}
```

## Read replicas (advanced)

Prisma 5+:
```bash
pnpm add @prisma/extension-read-replicas
```

```typescript
import { readReplicas } from "@prisma/extension-read-replicas";

prisma.$extends(
  readReplicas({
    url: process.env.READ_REPLICA_URL,
  }),
);
```

```typescript
// Default — primary
await prisma.user.findUnique({ where: { id } });

// Force replica (read-heavy)
await prisma.$replica().user.findMany();

// Force primary (read-after-write)
await prisma.$primary().user.findUnique({ where: { id } });
```

## Profiling

### Slow query log (Prisma)
```typescript
new PrismaClient({
  log: [{ emit: "event", level: "query" }],
});

prisma.$on("query", (e) => {
  if (e.duration > 100) console.warn(e.query, e.params, e.duration);
});
```

### Postgres
```sql
-- Top slow queries
SELECT query, calls, total_exec_time / calls AS avg_ms
FROM pg_stat_statements
ORDER BY avg_ms DESC
LIMIT 10;

-- Active connections
SELECT count(*), state FROM pg_stat_activity GROUP BY state;

-- Locks
SELECT * FROM pg_locks WHERE NOT granted;
```

### EXPLAIN ANALYZE
```typescript
const result = await prisma.$queryRaw`
  EXPLAIN ANALYZE
  SELECT * FROM "Post" WHERE "authorId" = ${authorId}
`;
console.log(result);
```

## Common bottleneck'ler

### `count()` slow on large table
```typescript
const total = await prisma.post.count();   // SCAN
```

Postgres alternatif:
```typescript
// Approximate count
const result = await prisma.$queryRaw<[{ count: bigint }]>`
  SELECT reltuples::bigint AS count FROM pg_class WHERE relname = 'Post'
`;
```

### Deep nested includes
```typescript
// ❌ 5 level deep
include: {
  author: {
    include: {
      organization: {
        include: {
          subscription: { include: { plan: true } },
        },
      },
    },
  },
}
```

Multiple roundtrips daha hızlı:
```typescript
const post = await prisma.post.findUnique({ where: { id }, include: { author: true } });
const org = await prisma.organization.findUnique({ where: { id: post.author.orgId } });
```

veya GraphQL DataLoader pattern.

### Missing FK index
Her relation field'a `@@index` ekle. EXPLAIN ANALYZE periodically run et.

## Aksiyon

1. include vs select discipline (select tercih)
2. FK columns ZORUNLU `@@index`
3. Composite index query pattern bazlı
4. pgBouncer production (transaction mode + pgbouncer=true)
5. Slow query monitoring (>100ms log)
6. EXPLAIN ANALYZE periodic check
7. Aggregate > findMany+map
8. Batch updates `updateMany`
9. Redis cache hot read paths
