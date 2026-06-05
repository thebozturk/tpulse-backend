---
name: testing-e2e
keywords: "e2e, end-to-end, flow, smoke"
description: "E2E test — full app, critical flows"
---

# E2E Test

## Kapsam

- Full app boot
- Real DB (testcontainers)
- Critical user flows
- <10 test toplam (yoksa yavaş)
- "Happy path + 1-2 edge case"

## Strateji

Integration test'ten farkı: **user perspective**. Register → verify → login → do stuff → logout.

```typescript
describe('Auth flow (e2e)', () => {
  let app: INestApplication;
  let mongoContainer: StartedTestContainer;

  beforeAll(async () => {
    mongoContainer = await new MongoDBContainer('mongo:7.0').start();
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

  it('user can register, login, fetch profile, logout', async () => {
    // Register
    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'alice@acme.com', password: 'Secret123!', name: 'Alice' })
      .expect(201);

    // Login
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'alice@acme.com', password: 'Secret123!' })
      .expect(200);

    const { accessToken, refreshToken } = loginRes.body;

    // Fetch profile
    const profileRes = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(profileRes.body.email).toBe('alice@acme.com');

    // Logout
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken })
      .expect(200);

    // Token artık geçerli değil
    await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);
  });
});
```

## Critical flows

- Register → Login → Use
- Password reset
- Payment flow
- Admin create user → user login
- API key create → API call → key revoke

## CI

E2E yavaş (10-60s per flow). Separate job:
```yaml
jobs:
  unit:
    # fast, every PR
  integration:
    # PR
  e2e:
    # main branch only veya nightly
```

## Aksiyon

1. <10 E2E test
2. Critical user flow'lar
3. Full app boot + real DB
4. Per-flow fresh DB
5. CI'da separate job
