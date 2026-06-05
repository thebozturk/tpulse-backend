---
name: testing-fixtures
keywords: "fixture, factory, seed, test data"
description: "Test data factory pattern"
---

# Fixtures

## Factory pattern

Test'te her defasında user, order yaratmak yerine factory:

```typescript
// test/fixtures/user.factory.ts
import { randomUUID } from 'crypto';

export interface UserFactoryOptions {
  email?: string;
  password?: string;
  role?: string;
  trustLevel?: number;
}

export function userFactory(overrides: UserFactoryOptions = {}): CreateUserDto {
  return {
    email: overrides.email ?? `user-${randomUUID()}@test.com`,
    password: overrides.password ?? 'TestPassword123!',
    name: overrides.name ?? 'Test User',
    role: overrides.role ?? 'user',
  };
}
```

Kullanım:
```typescript
// Default
const dto = userFactory();

// Override specific
const admin = userFactory({ role: 'admin', email: 'admin@test.com' });

// Çoklu
const users = Array.from({ length: 10 }, () => userFactory());
```

## DB'ye kaydet (integration)

```typescript
export async function seedUser(
  app: INestApplication,
  overrides?: UserFactoryOptions,
): Promise<User> {
  const model = app.get(getModelToken(User.name));
  const dto = userFactory(overrides);
  const hash = await argon2.hash(dto.password);
  return model.create({ ...dto, password: hash });
}

export async function seedUsers(app: INestApplication, count: number): Promise<User[]> {
  return Promise.all(Array.from({ length: count }, () => seedUser(app)));
}
```

## Related data

```typescript
export async function seedOrderWithUser(app: INestApplication) {
  const user = await seedUser(app);
  const orderModel = app.get(getModelToken(Order.name));
  const order = await orderModel.create({
    userId: user._id,
    amount: 100,
    status: 'pending',
  });
  return { user, order };
}
```

## Faker library

```bash
pnpm add -D @faker-js/faker
```

```typescript
import { faker } from '@faker-js/faker';

export function userFactory(overrides = {}) {
  return {
    email: faker.internet.email(),
    password: faker.internet.password(),
    name: faker.person.fullName(),
    ...overrides,
  };
}
```

## Deterministic tests

Faker seed:
```typescript
beforeEach(() => faker.seed(42));
```

Aynı seed = aynı data. Flaky test yok.

## Anti-pattern'ler

### Hardcoded email
```typescript
email: 'test@test.com'  // ❌ unique constraint fail ikinci test'te
```

### Factory'de side effect
```typescript
export function userFactory() {
  await db.save(...);  // ❌ factory sadece DTO döner, seed ayrı
}
```

### Real data
```typescript
email: 'ceo@realcompany.com'  // ❌ production email'i
```

## Aksiyon

1. test/fixtures/ klasörü
2. Her model için factory
3. Unique value (randomUUID, faker)
4. Related seed helper
5. Faker seed deterministic için
