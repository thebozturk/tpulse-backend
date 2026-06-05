---
name: prisma-queries
keywords: "query, find, create, update, delete, transaction, raw"
description: "CRUD queries, transactions, raw SQL"
---

# Queries

## findUnique / findFirst / findMany

```typescript
// findUnique — primary key veya @unique field
const user = await prisma.user.findUnique({ where: { id } });
const user = await prisma.user.findUnique({ where: { email } });

// findFirst — herhangi bir field, ilk match
const user = await prisma.user.findFirst({
  where: { name: { startsWith: "Ali" } },
  orderBy: { createdAt: "desc" },
});

// findMany — listele
const users = await prisma.user.findMany({
  where: { isActive: true },
  orderBy: { createdAt: "desc" },
  take: 20,
  skip: 0,
});

// findUniqueOrThrow / findFirstOrThrow — null yerine throw
const user = await prisma.user.findUniqueOrThrow({ where: { id } });
```

## where filters

```typescript
// Equality
{ where: { email: "x@y.com" } }
{ where: { age: 25 } }

// Comparison
{ where: { age: { gt: 18, lt: 65 } } }              // gt, gte, lt, lte
{ where: { createdAt: { gte: new Date("2026-01-01") } } }

// String
{ where: { email: { contains: "@acme" } } }
{ where: { name: { startsWith: "Ali", mode: "insensitive" } } }
{ where: { name: { endsWith: "yılmaz" } } }

// Array
{ where: { id: { in: ["a", "b", "c"] } } }
{ where: { id: { notIn: [...] } } }

// Logical
{ where: { AND: [{ age: { gt: 18 } }, { isActive: true }] } }
{ where: { OR: [{ email: "..." }, { phone: "..." }] } }
{ where: { NOT: { isDeleted: true } } }

// Null
{ where: { deletedAt: null } }
{ where: { deletedAt: { not: null } } }

// Nested relation
{ where: { author: { email: { contains: "@" } } } }
{ where: { posts: { some: { published: true } } } }
```

## select vs include

```typescript
// include — tüm field + relation
const post = await prisma.post.findUnique({
  where: { id },
  include: { author: true, tags: true },
});

// select — spesifik field
const post = await prisma.post.findUnique({
  where: { id },
  select: { id: true, title: true },
});

// Combine — nested
const post = await prisma.post.findUnique({
  where: { id },
  select: {
    id: true,
    title: true,
    author: {
      select: { id: true, name: true },  // sadece bu field'lar
    },
  },
});
```

**Performance**: `select` always preferred — less data over wire, less memory.

## create

```typescript
// Single
const user = await prisma.user.create({
  data: { email: "x@y.com", name: "Ali" },
});

// With relation (connect existing)
const post = await prisma.post.create({
  data: {
    title: "...",
    author: { connect: { id: "user-id" } },
    tags: { connect: [{ id: "tag1" }, { id: "tag2" }] },
  },
});

// With relation (create nested)
const user = await prisma.user.create({
  data: {
    email: "...",
    profile: { create: { bio: "..." } },           // 1:1 nested
    posts: { create: [{ title: "..." }] },         // 1:n nested
  },
});

// upsert
const user = await prisma.user.upsert({
  where: { email: "x@y.com" },
  create: { email: "x@y.com", name: "New" },
  update: { lastSeen: new Date() },
});

// createMany — bulk insert
await prisma.user.createMany({
  data: [
    { email: "a@x.com" },
    { email: "b@x.com" },
  ],
  skipDuplicates: true,
});
```

`createMany` Postgres'te native bulk insert — fast. Ama relation yok (sadece scalar), nested create yok.

## update

```typescript
// Single
const user = await prisma.user.update({
  where: { id },
  data: { name: "New Name" },
});

// updateMany — bulk
await prisma.user.updateMany({
  where: { isActive: false, lastSeen: { lt: cutoff } },
  data: { isArchived: true },
});

// Increment/decrement
await prisma.post.update({
  where: { id },
  data: {
    viewCount: { increment: 1 },
    score: { decrement: 5 },
  },
});

// Disconnect relation
await prisma.user.update({
  where: { id },
  data: {
    posts: { disconnect: { id: "post-id" } },
  },
});

// Set (replace) m:n
await prisma.post.update({
  where: { id },
  data: {
    tags: { set: [{ id: "tag1" }] },   // tüm tag'leri yeni set ile değiştir
  },
});
```

## delete

```typescript
// Single
await prisma.user.delete({ where: { id } });

// Bulk
await prisma.user.deleteMany({
  where: { lastSeen: { lt: cutoff } },
});
```

Cascade rules schema'daki `onDelete` directive'ine uyar.

## Transactions

### Sequential (interactive)
```typescript
const result = await prisma.$transaction(async (tx) => {
  const user = await tx.user.create({ data: { email } });
  const profile = await tx.profile.create({
    data: { userId: user.id, bio: "" },
  });
  return { user, profile };
});
```

`tx` — same client, transaction-scoped. Throw → rollback.

### Batch (non-interactive)
```typescript
const [users, posts] = await prisma.$transaction([
  prisma.user.findMany(),
  prisma.post.findMany(),
]);
```

Tüm queries paralel ama atomic.

### Isolation level
```typescript
await prisma.$transaction(
  async (tx) => { /* ... */ },
  {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    timeout: 10000,        // 10s
    maxWait: 5000,         // 5s wait for connection
  },
);
```

Levels: `ReadUncommitted`, `ReadCommitted` (default), `RepeatableRead`, `Serializable`.

## Raw SQL

### $queryRaw (returns rows)
```typescript
import { Prisma } from "@prisma/client";

const users = await prisma.$queryRaw<User[]>`
  SELECT id, email FROM users WHERE created_at > ${cutoff}
`;
```

Template literal `${value}` — Prisma escape eder, SQL injection güvenli.

```typescript
// ❌ DANGEROUS — string interpolation
await prisma.$queryRawUnsafe(`SELECT * FROM users WHERE id = '${id}'`);
// User input → SQL injection

// ✓ Use template literal veya parameterized
await prisma.$queryRaw`SELECT * FROM users WHERE id = ${id}`;
```

### $executeRaw (no return rows)
```typescript
await prisma.$executeRaw`UPDATE posts SET view_count = view_count + 1 WHERE id = ${id}`;
```

### Use cases for raw
- Complex aggregation Prisma desteklemediği
- Window functions (`ROW_NUMBER() OVER ...`)
- CTE / recursive
- Database-specific (PostGIS, vector ops)
- Performance-critical (Prisma overhead bypass)

**Default**: Prisma client. Raw sadece truly gerektiğinde.

## Pagination

### Offset (basic)
```typescript
const posts = await prisma.post.findMany({
  skip: page * pageSize,
  take: pageSize,
  orderBy: { createdAt: "desc" },
});
```

Slow on large skip. Sayfa 100 = 100K row scan.

### Cursor (recommended)
```typescript
const posts = await prisma.post.findMany({
  take: 20,
  cursor: lastSeenId ? { id: lastSeenId } : undefined,
  skip: lastSeenId ? 1 : 0,        // skip cursor item itself
  orderBy: { id: "asc" },
});

const nextCursor = posts.at(-1)?.id;
```

Hızlı, infinite-list ideal.

## Aggregation

```typescript
// Count
const count = await prisma.post.count({ where: { published: true } });

// Sum/avg/min/max
const stats = await prisma.order.aggregate({
  where: { userId },
  _sum: { total: true },
  _avg: { total: true },
  _max: { createdAt: true },
  _min: { createdAt: true },
  _count: true,
});

// Group by
const byCategory = await prisma.product.groupBy({
  by: ["categoryId"],
  _count: { _all: true },
  _avg: { price: true },
  having: { _count: { _all: { gt: 5 } } },
});
```

## Anti-pattern'ler

### N+1
```typescript
// ❌
const posts = await prisma.post.findMany();
for (const post of posts) {
  post.author = await prisma.user.findUnique({ where: { id: post.authorId } });
}
// 1 + N queries
```

```typescript
// ✓
const posts = await prisma.post.findMany({ include: { author: true } });
```

### `findFirst` + `where` yok = mass exposure
```typescript
// ❌ İlk record'u her kim çağırırsa görür — tenant leak
const config = await prisma.config.findFirst();
```

`where` her zaman explicit.

### `select: { id: true }` unutma
```typescript
// ❌ Tüm field'lar
const users = await prisma.user.findMany();

// ✓ Sadece gerekli
const users = await prisma.user.findMany({ select: { id: true, email: true } });
```

### Transaction içinde external API call
```typescript
// ❌ Long-running transaction → DB lock
await prisma.$transaction(async (tx) => {
  const order = await tx.order.create({ data });
  await stripeApi.charge(...);    // network call
  return order;
});
```

External call transaction OUTSIDE — rollback mantığı manuel handle:
```typescript
const order = await prisma.order.create({ data, status: "PENDING" });
try {
  await stripeApi.charge(...);
  await prisma.order.update({ where: { id: order.id }, data: { status: "PAID" } });
} catch {
  await prisma.order.update({ where: { id: order.id }, data: { status: "FAILED" } });
}
```

### Raw SQL string interpolation
Bkz. yukarıda — `$queryRawUnsafe` + string concat = SQL injection.

## Aksiyon

1. `select` always tercih (`include` sadece full row gerekirse)
2. N+1 → `include` ile eager
3. Cursor pagination (offset değil)
4. Transactions interactive sadece DB ops için (no external)
5. Raw SQL template literal (Unsafe ASLA)
6. `findUniqueOrThrow` not-found case için
7. Bulk → `createMany` + `skipDuplicates`
