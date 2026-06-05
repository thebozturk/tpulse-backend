---
name: nestjs-providers
keywords: "provider, inject, DI, useFactory, useValue, useClass, scope, custom provider"
description: "NestJS DI — provider çeşitleri, scope, custom token"
---

# NestJS Providers

## Provider çeşitleri

### 1. useClass (standart)
```typescript
providers: [UsersService]
// equiv to:
providers: [{ provide: UsersService, useClass: UsersService }]
```

### 2. useValue (sabit değer veya mock)
```typescript
providers: [
  { provide: 'API_KEY', useValue: process.env.API_KEY },
]

// Test'te mock
providers: [
  { provide: UsersService, useValue: { findById: jest.fn() } },
]
```

### 3. useFactory (dinamik)
```typescript
providers: [
  {
    provide: 'MAILER',
    useFactory: (config: ConfigService) => {
      return new Mailer({ apiKey: config.get('SENDGRID_KEY') });
    },
    inject: [ConfigService],
  },
]
```

### 4. useExisting (alias)
```typescript
providers: [
  LegacyUsersService,
  { provide: UsersService, useExisting: LegacyUsersService },
]
// UsersService ve LegacyUsersService aynı instance
```

## Custom injection token

String veya Symbol token:
```typescript
export const MAILER = Symbol('MAILER');

providers: [
  { provide: MAILER, useFactory: () => new Mailer() },
]

// Kullanım
constructor(@Inject(MAILER) private readonly mailer: Mailer) {}
```

**String yerine Symbol tercih** — collision yok.

## Scope

### Default (singleton)
```typescript
@Injectable()
export class UsersService {}
```
Uygulama başında bir kez oluşur, her yerde aynı instance.

### Request-scoped
```typescript
@Injectable({ scope: Scope.REQUEST })
export class RequestLogger {
  constructor(@Inject(REQUEST) private readonly req: Request) {}
}
```

Her HTTP request için yeni instance. Performance cost — ihtiyaç yoksa kullanma.

### Transient
```typescript
@Injectable({ scope: Scope.TRANSIENT })
export class PerUsageService {}
```

Her inject edildiğinde yeni instance. Nadir gerek.

## Optional injection

```typescript
constructor(@Optional() private readonly logger?: CustomLogger) {}
```

Provider yoksa `undefined` olur. Opsiyonel feature'larda kullan.

## Pattern'ler

### Repository pattern

```typescript
// Interface (abstract)
export abstract class UserRepository {
  abstract findById(id: string): Promise<User | null>;
  abstract save(user: User): Promise<User>;
}

// Implementation
@Injectable()
export class MongoUserRepository extends UserRepository {
  constructor(@InjectModel(User.name) private readonly model: Model<User>) {
    super();
  }
  async findById(id: string) { return this.model.findById(id).lean(); }
  async save(user: User) { return this.model.create(user); }
}

// Module
@Module({
  providers: [{ provide: UserRepository, useClass: MongoUserRepository }],
  exports: [UserRepository],
})
```

Service:
```typescript
@Injectable()
export class UsersService {
  constructor(private readonly repo: UserRepository) {}
  // DB-specific kod YOK, sadece repo interface'i
}
```

Test:
```typescript
// Test'te in-memory repo
{ provide: UserRepository, useValue: new InMemoryUserRepository() }
```

### Factory with dependencies

```typescript
{
  provide: 'EMAIL_TEMPLATE_ENGINE',
  useFactory: async (config: ConfigService): Promise<TemplateEngine> => {
    const templates = await loadTemplates(config.get('TEMPLATE_DIR'));
    return new TemplateEngine(templates);
  },
  inject: [ConfigService],
}
```

Async factory desteklenir.

## Anti-pattern'ler

### `new` ile yaratma
```typescript
// KÖTÜ
@Injectable()
export class OrderService {
  private mailer = new Mailer();  // DI bypass
}

// İYİ
@Injectable()
export class OrderService {
  constructor(private readonly mailer: MailerService) {}
}
```

### Global state
```typescript
// KÖTÜ
@Injectable()
export class UserService {
  private static cache = new Map();  // shared mutable state
}

// İYİ — Redis inject et, state dışarıda
@Injectable()
export class UserService {
  constructor(private readonly cache: CacheService) {}
}
```

### Property injection (avoid)
```typescript
// KÖTÜ (test'te mock zor)
@Inject() private readonly userRepo: UserRepository;

// İYİ
constructor(private readonly userRepo: UserRepository) {}
```

## Aksiyon

1. Her service `@Injectable()` decorator taşır
2. Dependency'ler constructor'dan gelir
3. Interface ile abstract — implementation swap edilebilir
4. Test'te `{ provide: Real, useValue: mock }` ile override
5. Global state'ten kaç, state'i dışarıda tut (Redis, DB)
