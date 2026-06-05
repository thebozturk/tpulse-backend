---
name: prisma-schema
keywords: "schema.prisma, model, field, attribute, naming"
description: "Schema design — model, field, attribute, naming convention"
---

# schema.prisma

## Model

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?  // optional
  role      Role     @default(USER)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  posts     Post[]
  profile   Profile?

  @@map("users")           // table name (plural in DB)
  @@index([email])
  @@index([createdAt])
}

enum Role {
  USER
  ADMIN
  MODERATOR
}
```

## Naming convention

- **Model**: PascalCase singular — `User`, `Post`, `OrderItem`
- **Field**: camelCase — `firstName`, `createdAt`, `isActive`
- **Relation field (singular)**: camelCase — `author`, `profile`
- **Relation field (plural)**: camelCase plural — `posts`, `comments`
- **Enum**: PascalCase, values UPPER_SNAKE — `enum OrderStatus { PENDING, SHIPPED }`
- **Table**: `@@map` ile plural snake_case — `users`, `order_items`
- **Column**: `@map` ile camelCase → snake_case — `firstName` → `first_name`

DB-level snake_case (Postgres convention) + code-level camelCase (TS convention).

## Field types

```prisma
// Scalar
id          Int       @id @default(autoincrement())
uuid        String    @id @default(uuid())
cuid        String    @id @default(cuid())     // recommended (sortable, URL-safe)
email       String
age         Int
price       Decimal   @db.Decimal(10, 2)
isActive    Boolean
data        Json
createdAt   DateTime  @default(now())
content     String    @db.Text                  // long text
description String?   @db.VarChar(500)

// Arrays (PostgreSQL only)
tags        String[]
scores      Int[]

// Bytes
avatar      Bytes?
```

## Attributes

### Field-level

```prisma
@id                      // primary key
@unique                  // unique constraint
@default(...)            // default value
@updatedAt               // auto-update on change
@map("col_name")         // DB column name
@db.VarChar(255)         // DB-specific type
@db.Decimal(10, 2)
```

### Block-level

```prisma
@@id([orgId, userId])    // composite primary key
@@unique([userId, slug]) // composite unique
@@index([email])         // index
@@map("table_name")      // DB table name
@@fulltext([title, content])  // FT index (preview)
```

## CUID vs UUID vs autoincrement

| Type | Pros | Cons |
|------|------|------|
| `autoincrement()` | Compact (4-8B), fast | Predictable, exposes count |
| `uuid()` | Random, secure | 16B, not sortable |
| `cuid()` | Sortable, URL-safe, secure | 24B |
| `cuid2()` | Cuid + collision-resistant | 24B, slightly slower |

**Default seçim**: `cuid()` — production'da iyi balance.

## Common patterns

### Soft delete
```prisma
model Post {
  id        String    @id @default(cuid())
  title     String
  content   String
  deletedAt DateTime?

  @@index([deletedAt])
}
```

Query'de filter:
```typescript
this.prisma.post.findMany({
  where: { deletedAt: null },
});
```

### Audit fields
```prisma
model Post {
  id          String   @id @default(cuid())
  title       String

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  createdById String
  updatedById String?

  createdBy   User     @relation("PostCreatedBy", fields: [createdById], references: [id])
  updatedBy   User?    @relation("PostUpdatedBy", fields: [updatedById], references: [id])
}
```

### Versioning (optimistic concurrency)
```prisma
model Post {
  id      String @id @default(cuid())
  title   String
  version Int    @default(1)

  @@index([id, version])
}
```

Update'te version check:
```typescript
this.prisma.post.update({
  where: { id, version: currentVersion },
  data: { title: "new", version: { increment: 1 } },
});
// Throws if version mismatch (RecordNotFound)
```

### Multi-tenant
```prisma
model Post {
  id     String @id @default(cuid())
  orgId  String
  title  String

  org    Organization @relation(fields: [orgId], references: [id])

  @@index([orgId, createdAt])
}
```

Her query'de `where: { orgId }` ekle (tenant isolation).

### JSONB column
```prisma
model Event {
  id       String @id @default(cuid())
  type     String
  payload  Json   @db.JsonB

  @@index([type])
  @@index([payload(ops: JsonbPathOps)], type: Gin)  // payload içinde search
}
```

```typescript
// Search inside JSON
await this.prisma.event.findMany({
  where: { payload: { path: ["userId"], equals: "abc" } },
});
```

### Timestamps
```prisma
model Base {
  // Postgres timezone-aware
  createdAt DateTime @default(now()) @db.Timestamptz(6)
  updatedAt DateTime @updatedAt @db.Timestamptz(6)
}
```

Always `Timestamptz` over `Timestamp` — timezone-aware safer.

## Comments

Schema field'ları comment ile dökümante:

```prisma
model User {
  /// User'ın benzersiz kimliği. URL'lerde kullanılır.
  id    String @id @default(cuid())

  /// Login için. Lowercased + trimmed.
  email String @unique
}
```

`///` — generated TypeScript JSDoc'a geçer.
`//` — schema comment, kod'a yansımaz.

## Anti-pattern'ler

### Tüm tablolar `id Int @id @default(autoincrement())`
URL'de `/posts/1, /posts/2` exposed. Use cuid() public-facing modeller için.

### `Json` everywhere
Schema-less = no validation, no index. JSONB sadece truly dynamic data için.

### `String?` (nullable) overuse
"İlerleyen sürümlerde gerekli olabilir" diye optional bırakma. Required ise required, optional ise gerçekten opt — middle ground yok.

### No `@@index`
Foreign key columnların indexi otomatik DEĞİL Prisma'da. Manuel ekle.

### `@@unique` `@unique` karışıklığı
Tek field için `@unique`, composite için `@@unique([a, b])`.

### Migration'sız schema değişikliği
Schema'yı edit edip `prisma generate` yapma → DB'yle desync. Hep `prisma migrate dev`.

## Best practices

1. cuid() public-facing IDs
2. Timestamptz timestamp'ler için
3. snake_case DB names (`@@map`, `@map`)
4. Foreign key + manual `@@index`
5. JSDoc comments (`///`) generated client'a yansır
6. Soft delete `deletedAt DateTime?` filter ile
7. Multi-tenant — her query'de `orgId` filter
