---
name: testing-integration
keywords: "integration, testcontainers, supertest, db, real"
description: "Integration test — testcontainers, gerçek MongoDB"
---

# Integration Test

## Kapsam

- Birden fazla modül birlikte
- Gerçek DB (testcontainers)
- HTTP request (supertest)
- Infra (Redis, RabbitMQ mock veya real)
- ~100ms-1s/test

## Testcontainers

```bash
pnpm add -D testcontainers mongodb-memory-server @testcontainers/mongodb
```

Mongo replica set (transaction için):
```typescript
import { MongoDBContainer } from '@testcontainers/mongodb';

describe('UsersController (integration)', () => {
  let app: INestApplication;
  let mongoContainer: StartedTestContainer;

  beforeAll(async () => {
    mongoContainer = await new MongoDBContainer('mongo:7.0')
      .withExposedPorts(27017)
      .start();

    process.env.DATABASE_URL = mongoContainer.getConnectionString();

    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  }, 60_000);

  afterAll(async () => {
    await app.close();
    await mongoContainer.stop();
  });

  it('POST /users creates and returns user', async () => {
    const res = await request(app.getHttpServer())
      .post('/users')
      .send({ email: 'a@b.com', password: 'secret-123', name: 'A' })
      .expect(201);

    expect(res.body.email).toBe('a@b.com');
    expect(res.body.password).toBeUndefined();
  });
});
```

## Cleanup between tests

```typescript
beforeEach(async () => {
  const connection = app.get(getConnectionToken());
  await connection.db.dropDatabase();
});
```

Her test'ten önce temiz DB. Alternatif: test başında transaction, sonunda rollback.

## Fixtures

```typescript
// test/fixtures/user.fixture.ts
export async function createUserFixture(app: INestApplication, overrides?: Partial<User>) {
  const defaults = {
    email: `user-${randomUUID()}@test.com`,
    password: 'TestPassword123!',
    name: 'Test User',
  };
  const res = await request(app.getHttpServer())
    .post('/users')
    .send({ ...defaults, ...overrides })
    .expect(201);
  return res.body;
}
```

## CI ortamında

GitHub Actions service container:
```yaml
services:
  mongo:
    image: mongo:7.0
    ports:
      - 27017:27017
    options: >-
      --health-cmd "mongosh --eval 'db.runCommand({ping:1})'"
      --health-interval 10s
```

Veya testcontainers (Docker-in-Docker).

## Aksiyon

1. Testcontainers Mongo replica set
2. beforeAll start, afterAll stop
3. beforeEach dropDatabase
4. Fixture factory
5. ValidationPipe test'te de
6. CI service container
