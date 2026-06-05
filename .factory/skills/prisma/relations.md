---
name: prisma-relations
keywords: "relation, 1:1, 1:n, n:m, foreign key, cascade"
description: "Relations — 1:1, 1:n, many-to-many, self-relation"
---

# Relations

## 1:n (one-to-many)

```prisma
model User {
  id    String @id @default(cuid())
  posts Post[]                       // implicit relation field
}

model Post {
  id       String @id @default(cuid())
  authorId String                     // foreign key
  author   User   @relation(fields: [authorId], references: [id])

  @@index([authorId])
}
```

Query:
```typescript
// Posts include author
const posts = await prisma.post.findMany({ include: { author: true } });

// User include posts
const user = await prisma.user.findUnique({
  where: { id },
  include: { posts: true },
});
```

## 1:1

```prisma
model User {
  id      String   @id @default(cuid())
  profile Profile?
}

model Profile {
  id     String @id @default(cuid())
  bio    String
  userId String @unique               // unique = 1:1
  user   User   @relation(fields: [userId], references: [id])
}
```

`@unique` foreign key — 1 user = 1 profile.

## n:m (many-to-many)

### Implicit (junction table auto)
```prisma
model Post {
  id   String @id @default(cuid())
  tags Tag[]
}

model Tag {
  id    String @id @default(cuid())
  posts Post[]
}
```

Prisma `_PostToTag` join table'ı arka planda oluşturur.

```typescript
// Connect existing tags
await prisma.post.create({
  data: {
    title: "...",
    tags: {
      connect: [{ id: "tag1" }, { id: "tag2" }],
    },
  },
});

// Disconnect
await prisma.post.update({
  where: { id },
  data: { tags: { disconnect: { id: "tag1" } } },
});
```

### Explicit (junction table sen yönet)
```prisma
model Post {
  id    String     @id @default(cuid())
  tags  PostTag[]
}

model Tag {
  id    String     @id @default(cuid())
  name  String     @unique
  posts PostTag[]
}

model PostTag {
  postId    String
  tagId     String
  createdAt DateTime @default(now())     // extra metadata mümkün
  position  Int                            // sıralama

  post      Post @relation(fields: [postId], references: [id])
  tag       Tag  @relation(fields: [tagId], references: [id])

  @@id([postId, tagId])
  @@index([tagId])
}
```

Junction table'da extra field gerekirse explicit kullan.

## Self-relation

### Hierarchy (parent-child)
```prisma
model Category {
  id       String     @id @default(cuid())
  name     String
  parentId String?
  parent   Category?  @relation("CategoryHierarchy", fields: [parentId], references: [id])
  children Category[] @relation("CategoryHierarchy")

  @@index([parentId])
}
```

`@relation("name")` — self-relation isim ZORUNLU (her iki yönü ayırmak için).

### Friend / follow (m:n self-relation)
```prisma
model User {
  id            String     @id @default(cuid())
  followedBy    Follow[]   @relation("UserFollows")
  following     Follow[]   @relation("UserFollowing")
}

model Follow {
  followerId   String
  followingId  String
  createdAt    DateTime @default(now())

  follower     User @relation("UserFollowing", fields: [followerId], references: [id])
  following    User @relation("UserFollows", fields: [followingId], references: [id])

  @@id([followerId, followingId])
  @@index([followingId])
}
```

## Cascade actions

```prisma
model Post {
  authorId String
  author   User @relation(
    fields: [authorId],
    references: [id],
    onDelete: Cascade,           // User silinirse post da silinir
    onUpdate: Cascade,
  )
}
```

### onDelete options
- `Cascade` — parent silinince child silinir
- `Restrict` — child varsa parent silinemez (default in Postgres)
- `SetNull` — child'ın FK'i null olur (FK nullable olmalı)
- `SetDefault` — default value
- `NoAction` — DB-level, lazy check

### Use case'ler

**User → Posts**: User silinirse post'lar gitsin → `Cascade`
**User → AuditLog**: User silinirse audit log kalsın → `SetNull` (`userId String?`)
**Order → OrderItem**: Order silinirse items gitsin → `Cascade`
**Category → Product**: Category silinmek için boş olsun → `Restrict`

## Polymorphic relations (Prisma'da NATIVE YOK)

Prisma polymorphic FK desteklemiyor. Workaround:

### Option 1 — Multiple FK
```prisma
model Comment {
  id        String  @id @default(cuid())
  content   String
  postId    String?
  productId String?

  post      Post?    @relation(fields: [postId], references: [id])
  product   Product? @relation(fields: [productId], references: [id])

  @@check(num_nonnulls(postId, productId) = 1)  // sadece bir FK dolu
}
```

### Option 2 — String type discriminator
```prisma
model Comment {
  id           String @id @default(cuid())
  content      String
  parentType   String  // "Post" | "Product"
  parentId     String

  @@index([parentType, parentId])
}
```

Type-safety yok, query'de manuel join.

### Option 3 — Separate tables
`PostComment`, `ProductComment` — type-safe ama duplicate logic.

Recommendation: Option 1 ya da 3 (type-safety > flexibility).

## Filtered queries on relations

```typescript
// Post'ları author email'ine göre filter
const posts = await prisma.post.findMany({
  where: {
    author: { email: { contains: "@acme.com" } },
  },
});

// At least one tag
const posts = await prisma.post.findMany({
  where: {
    tags: { some: { name: "typescript" } },
  },
});

// All tags satisfy
const posts = await prisma.post.findMany({
  where: {
    tags: { every: { active: true } },
  },
});

// No tags match
const posts = await prisma.post.findMany({
  where: {
    tags: { none: { name: "deprecated" } },
  },
});
```

## Anti-pattern'ler

### Foreign key index unutma
```prisma
model Post {
  authorId String
  author   User @relation(fields: [authorId], references: [id])
  // ❌ index yok → büyük tablo n+1 query slow
}
```

```prisma
@@index([authorId])
```

### Cascade düşünmeden Cascade
```prisma
onDelete: Cascade
// User silindi → 100K post silindi → audit kayboldu
```

Audit / immutable log'lar için `SetNull` veya `Restrict`.

### Relation field foreign key'i replace ediyor sanma
```typescript
// ❌ relation field set
{ author: { id: "abc" } }   // Prisma anlamaz

// ✓ FK direct
{ authorId: "abc" }

// ✓ veya connect
{ author: { connect: { id: "abc" } } }
```

### Implicit m:n'de extra field gerekirse
Implicit junction → extra field yok. Explicit'e dön.

## Aksiyon

1. 1:n: FK + index (`@@index([authorId])`)
2. 1:1: `@unique` foreign key
3. n:m: implicit (basit) veya explicit (extra fields)
4. Self-relation: `@relation("name")` zorunlu
5. Cascade düşün: `Cascade` mı `SetNull` mı `Restrict` mi
6. Foreign key index ZORUNLU (Postgres auto eklemez)
7. Polymorphic yerine multi-FK + check constraint
