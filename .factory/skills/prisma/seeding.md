---
name: prisma-seeding
keywords: "seed, fixture, faker, test data"
description: "Database seeding — dev fixture, test data"
---

# Seeding

## prisma/seed.ts

```typescript
// prisma/seed.ts
import { PrismaClient, Role } from "@prisma/client";
import { faker } from "@faker-js/faker";

const prisma = new PrismaClient();

async function main() {
  // Cleanup (dev only)
  await prisma.post.deleteMany();
  await prisma.user.deleteMany();

  // Admin (deterministic)
  const admin = await prisma.user.upsert({
    where: { email: "admin@acme.com" },
    update: {},
    create: {
      email: "admin@acme.com",
      name: "Admin",
      role: Role.ADMIN,
    },
  });

  // Random users (faker)
  const users = await Promise.all(
    Array.from({ length: 10 }).map(() =>
      prisma.user.create({
        data: {
          email: faker.internet.email(),
          name: faker.person.fullName(),
        },
      }),
    ),
  );

  // Posts for each user
  for (const user of users) {
    await prisma.post.createMany({
      data: Array.from({ length: faker.number.int({ min: 1, max: 5 }) }).map(() => ({
        title: faker.lorem.sentence(),
        content: faker.lorem.paragraphs(3),
        authorId: user.id,
        published: faker.datatype.boolean(),
      })),
    });
  }

  console.log(`Seeded: ${users.length + 1} users, posts created`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

## package.json — seed config

```json
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  },
  "devDependencies": {
    "@faker-js/faker": "^8.0.0",
    "tsx": "^4.0.0"
  }
}
```

## Run

```bash
npx prisma db seed
```

`prisma migrate dev` ve `prisma migrate reset` otomatik seed çalıştırır.

## Idempotent (re-run safe)

```typescript
// upsert pattern — re-run safe
await prisma.user.upsert({
  where: { email: "admin@acme.com" },
  update: {},                          // exists → no change
  create: { email: "admin@acme.com", name: "Admin" },
});
```

`createMany` + `skipDuplicates` bulk için:
```typescript
await prisma.tag.createMany({
  data: [
    { name: "typescript" },
    { name: "react" },
  ],
  skipDuplicates: true,
});
```

## Multi-environment

```typescript
// prisma/seed.ts
async function main() {
  await seedAdmin();          // every env
  await seedTags();           // every env

  if (process.env.NODE_ENV === "development") {
    await seedFakeData();     // dev only
  }

  if (process.env.NODE_ENV === "test") {
    await seedTestFixtures(); // test only
  }
}
```

## Test fixtures (separate)

Test isolation için seed ≠ test fixture:

```typescript
// test/fixtures.ts
export async function createUser(overrides?: Partial<User>) {
  return prisma.user.create({
    data: {
      email: faker.internet.email(),
      name: faker.person.fullName(),
      ...overrides,
    },
  });
}

export async function createPost(authorId: string, overrides?: Partial<Post>) {
  return prisma.post.create({
    data: {
      title: faker.lorem.sentence(),
      content: faker.lorem.paragraph(),
      authorId,
      ...overrides,
    },
  });
}
```

```typescript
// test/users.e2e-spec.ts
beforeEach(async () => {
  await prisma.cleanDatabase();
  await prisma.tag.createMany({ data: [...defaultTags] });
});

it("creates post", async () => {
  const user = await createUser({ role: "ADMIN" });
  const post = await createPost(user.id, { title: "Test" });
  expect(post.title).toBe("Test");
});
```

## Hierarchical / referential

```typescript
// Categories with hierarchy
const root = await prisma.category.create({ data: { name: "Root" } });
const tech = await prisma.category.create({ data: { name: "Tech", parentId: root.id } });
const ai = await prisma.category.create({ data: { name: "AI", parentId: tech.id } });
```

## Anti-pattern'ler

### Production'da seed çalıştırma
```bash
# ❌ Production
npx prisma db seed
# deleteMany() var → DATA WIPE
```

`NODE_ENV` check seed.ts başında zorunlu:
```typescript
if (process.env.NODE_ENV === "production") {
  throw new Error("Seed production'da yasak");
}
```

### Faker seedless
```typescript
// ❌ Run her seferinde farklı data
faker.person.fullName();
```

Reproducible için:
```typescript
faker.seed(123);   // deterministic
```

### Sequential (yavaş)
```typescript
// ❌ 100 user → 100 await
for (let i = 0; i < 100; i++) {
  await prisma.user.create({ data: { ... } });
}
```

```typescript
// ✓ Parallel
await Promise.all(
  Array.from({ length: 100 }).map(() =>
    prisma.user.create({ data: { ... } }),
  ),
);

// ✓✓ Bulk insert
await prisma.user.createMany({
  data: Array.from({ length: 100 }).map(() => ({ email: faker.internet.email() })),
});
```

## Aksiyon

1. `prisma/seed.ts` + `package.json prisma.seed` config
2. faker.js dev data, deterministic seed (`faker.seed`)
3. Idempotent — `upsert` veya `createMany skipDuplicates`
4. Production guard — `NODE_ENV === "production"` throw
5. Multi-env — common + dev/test specific
6. Test fixtures ayrı dosya (`test/fixtures.ts`)
7. Bulk insert (`createMany`) > sequential
