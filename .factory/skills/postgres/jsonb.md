---
name: postgres-jsonb
keywords: "jsonb, json, dynamic, schemaless"
description: "JSONB type — structured + flexible storage"
---

# JSONB

Schema-less data column. Postgres native parse + index.

## JSON vs JSONB

| | JSON | JSONB |
|--|------|-------|
| Storage | Text (verbatim) | Binary (parsed) |
| Insert speed | Faster | Slightly slower |
| Query speed | Slow (parse each time) | Fast |
| Index | Limited | GIN |
| Whitespace preserved | ✓ | ✗ |

**Default**: JSONB. JSON sadece "preserve raw text" gerektiğinde.

## Prisma'da

```prisma
model Event {
  id      String @id @default(cuid())
  type    String
  payload Json   @db.JsonB
  createdAt DateTime @default(now())

  @@index([type])
}
```

`Json` Prisma type → `@db.JsonB` ile binary storage.

## Insert

```typescript
await prisma.event.create({
  data: {
    type: "user.created",
    payload: {
      userId: "abc",
      email: "x@y.com",
      meta: { source: "signup" },
    },
  },
});
```

## Query — operators

### `->` (returns JSON)
```sql
SELECT payload->'meta' FROM events;
-- Returns: '{"source": "signup"}' (JSON)
```

### `->>` (returns text)
```sql
SELECT payload->>'userId' FROM events;
-- Returns: 'abc' (text, not JSON)
```

### Path navigation
```sql
SELECT payload->'meta'->>'source' FROM events WHERE id = '...';
```

### `@>` (contains)
```sql
SELECT * FROM events WHERE payload @> '{"type": "VIP"}';
```

### `?` (key exists)
```sql
SELECT * FROM events WHERE payload ? 'discount';
```

## Prisma JSONB query

```typescript
// path query
await prisma.event.findMany({
  where: { payload: { path: ["userId"], equals: "abc" } },
});

// path with nested
await prisma.event.findMany({
  where: { payload: { path: ["meta", "source"], equals: "signup" } },
});

// array_contains
await prisma.event.findMany({
  where: { payload: { array_contains: ["typescript"] } },
});

// string_contains
await prisma.event.findMany({
  where: { payload: { path: ["description"], string_contains: "premium" } },
});
```

Limited — complex query için raw SQL:
```typescript
await prisma.$queryRaw<Event[]>`
  SELECT * FROM "Event"
  WHERE payload @> ${JSON.stringify({ tags: ["important"] })}::jsonb
`;
```

## Indexing

### GIN index — full ops (any operator)
```sql
CREATE INDEX events_payload_idx ON events USING GIN(payload);
```

Supports `@>`, `?`, `?&`, `?|`, path queries.

### GIN index — path ops (smaller, faster for path-only)
```sql
CREATE INDEX events_payload_idx ON events USING GIN(payload jsonb_path_ops);
```

Sadece `@>` operator. Smaller index.

### Expression index (specific path frequent)
```sql
CREATE INDEX events_user_idx ON events((payload->>'userId'));

-- Query uses it
SELECT * FROM events WHERE payload->>'userId' = 'abc';
```

## Update

### Replace whole field
```typescript
await prisma.event.update({
  where: { id },
  data: { payload: newPayload },
});
```

### Patch (jsonb_set)
```typescript
await prisma.$executeRaw`
  UPDATE events
  SET payload = jsonb_set(payload, '{meta,verified}', 'true'::jsonb)
  WHERE id = ${id}
`;
```

```typescript
// Append to array
await prisma.$executeRaw`
  UPDATE events
  SET payload = jsonb_set(
    payload,
    '{tags}',
    (payload->'tags') || '"new-tag"'::jsonb
  )
  WHERE id = ${id}
`;
```

## Use cases

### Webhook payload (varying shape)
```prisma
model WebhookEvent {
  id       String @id @default(cuid())
  source   String  // "stripe", "github"
  type     String
  payload  Json   @db.JsonB
  createdAt DateTime @default(now())

  @@index([source, type, createdAt])
  @@index([payload(ops: JsonbPathOps)], type: Gin)
}
```

### User metadata (extensible)
```prisma
model User {
  id       String @id @default(cuid())
  email    String @unique
  metadata Json   @default("{}") @db.JsonB
}
```

User-spesifik field'lar (preferences, custom data) — schema değişikliği gerektirmez.

### Audit log
```prisma
model Audit {
  id         String @id @default(cuid())
  action     String  // "user.update"
  before     Json?  @db.JsonB
  after      Json?  @db.JsonB
  userId     String
  createdAt  DateTime @default(now())
}
```

Before/after snapshot — flexible structure.

### Configuration
```prisma
model Config {
  key      String @id
  value    Json   @db.JsonB
  updatedAt DateTime @updatedAt
}
```

```typescript
const featureFlags = await prisma.config.findUnique({ where: { key: "features" } });
// { enableNewDashboard: true, betaUsers: ["abc", "xyz"] }
```

## Type safety on JSONB

JSONB Prisma'da `JsonValue` type — runtime'da herhangi bir şey olabilir.

```typescript
// zod ile validate
import { z } from "zod";

const eventPayloadSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("user.created"), userId: z.string() }),
  z.object({ type: z.literal("order.placed"), orderId: z.string(), total: z.number() }),
]);

type EventPayload = z.infer<typeof eventPayloadSchema>;

const event = await prisma.event.findUnique({ where: { id } });
const payload = eventPayloadSchema.parse(event.payload);
// Now type-safe
```

## Anti-pattern'ler

### Schema as JSONB blob
```prisma
model User {
  id   String @id
  data Json   @db.JsonB     // ❌ everything in JSONB
}
```

Structured field'lar (email, name, role) proper column. JSONB sadece truly dynamic.

### Frequent JSONB query without index
```sql
SELECT * FROM events WHERE payload->>'userId' = 'abc';
-- 1M rows → seq scan
```

GIN index veya expression index.

### Deeply nested JSONB
```json
{ "a": { "b": { "c": { "d": "value" } } } }
```

Query verbose, index complicated. Flatten ya da relational design.

### Large JSONB (>1MB)
Storage + memory cost. Large object → file/blob storage (S3) + URL'i JSONB'de.

### JSONB key inconsistency
```json
// Row 1: { "userId": "abc" }
// Row 2: { "user_id": "abc" }
// Row 3: { "uid": "abc" }
```

Convention enforce et — zod schema, ApplicationLevel validation.

## Aksiyon

1. JSONB > JSON (binary, indexed)
2. GIN index frequent JSONB queries için
3. Expression index specific path query için
4. zod schema runtime type-safety
5. JSONB sadece truly dynamic data (structured field column)
6. Deep nesting (>3 level) avoid
7. Large object (>100KB) JSONB'de tutma
