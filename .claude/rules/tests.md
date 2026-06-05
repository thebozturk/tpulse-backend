---
globs: "**/*.spec.ts,**/*.test.ts,test/**,tests/**"
severity: must
---

# Test Kuralları

Test dosyaları (`.spec.ts`, `.test.ts`, `test/` ve `tests/` altı).

## MUST

- `describe` ile suite sarılır
- Her test `it('should ...', ...)` veya `test('...', ...)` formatında
- AAA pattern: Arrange → Act → Assert
- `beforeEach` ile state reset
- Mock'lar `afterEach(() => jest.clearAllMocks())` ile temizlenir
- Her test BAĞIMSIZ (order'a bağlı değil)
- Async test `async/await` kullanır (done callback yasak)
- Timeout gerekiyorsa explicit (`jest.setTimeout(30000)` test başında)

## SHOULD

- Test adı: `should X when Y` veya `<method>_<condition>_<expected>`
- Bir test = bir davranış (multi-assertion OK ama tek logical test)
- Mock kurulum `beforeEach`'te, custom override test içinde
- Fixture factory kullan (`userFactory({ overrides })`)
- Integration test'te testcontainers (real MongoDB)
- E2E test'te gerçek HTTP (supertest)

## ASLA

- `it.only` veya `describe.only` commit etme
- `it.skip` sebep açıklaması olmadan
- `console.log` test içinde (debug sonrası temizle)
- `any` type (strict mode test'te de geçerli)
- `setTimeout` ile wait (use waitFor / async chain)
- Gerçek dış API çağrısı (MSW veya fixture)
- Gerçek DB'ye yazma (testcontainers kullan)
- Test'ten production kod değiştirme
- `jest.useFakeTimers` sonra `useRealTimers` yapmadan test bitirme
- Global state'e yazma (`process.env.X = ...` without cleanup)

## Örnekler

### İyi — Unit test
```typescript
describe('UsersService', () => {
  let service: UsersService;
  let userModel: Model<User>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getModelToken(User.name),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            findById: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(UsersService);
    userModel = module.get(getModelToken(User.name));
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('should create user when email unique', async () => {
      // Arrange
      const dto = { email: 'alice@acme.com', password: 'pw-123456', name: 'Alice' };
      (userModel.findOne as jest.Mock).mockReturnValue({ lean: () => null });
      (userModel.create as jest.Mock).mockResolvedValue({
        toObject: () => ({ id: '1', ...dto, password: 'hashed' }),
      });

      // Act
      const result = await service.create(dto);

      // Assert
      expect(result.id).toBe('1');
      expect(result.email).toBe('alice@acme.com');
      expect(userModel.create).toHaveBeenCalledOnce();
    });

    it('should throw ConflictException when email exists', async () => {
      (userModel.findOne as jest.Mock).mockReturnValue({ lean: () => ({ id: '1' }) });

      await expect(
        service.create({ email: 'alice@acme.com', password: 'x', name: 'A' })
      ).rejects.toThrow(ConflictException);
    });
  });
});
```

### İyi — Integration test
```typescript
describe('Users (integration)', () => {
  let app: INestApplication;
  let mongoContainer: StartedTestContainer;

  beforeAll(async () => {
    mongoContainer = await new GenericContainer('mongo:7').withExposedPorts(27017).start();
    process.env.DATABASE_URL = `mongodb://${mongoContainer.getHost()}:${mongoContainer.getMappedPort(27017)}/test`;

    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  }, 60000);

  afterAll(async () => {
    await app.close();
    await mongoContainer.stop();
  });

  it('POST /users returns 201 with created user', async () => {
    const res = await request(app.getHttpServer())
      .post('/users')
      .send({ email: 'alice@acme.com', password: 'pw-123456', name: 'Alice' })
      .expect(201);

    expect(res.body).toMatchObject({ email: 'alice@acme.com', name: 'Alice' });
    expect(res.body.password).toBeUndefined(); // select: false
    expect(res.body.id).toBeDefined();
  });

  it('POST /users returns 400 on invalid email', async () => {
    await request(app.getHttpServer())
      .post('/users')
      .send({ email: 'not-an-email', password: 'x', name: 'A' })
      .expect(400);
  });
});
```

### Kötü
```typescript
describe('Users', () => {
  let service;                            // ❌ type yok

  it('test1', async (done) => {           // ❌ isim, done callback
    const result: any = await service.create();  // ❌ any
    console.log(result);                  // ❌ console.log
    setTimeout(() => {                     // ❌ setTimeout wait
      expect(result).toBeTruthy();         // ❌ meaningful assert yok
      done();
    }, 100);
  });

  it.skip('broken test', () => {});        // ❌ skip + açıklama yok
});
```

## Coverage hedefi

- Unit: >80% lines, >75% branches
- Integration: kritik path'ler + 2-3 failure path
- E2E: her major flow 1 smoke test

Düşük coverage'lı modüller `.factory/memory/error-log.jsonl`'e düşmez ama `/test coverage` ile görünür.
