---
name: dependency-injection
keywords: "DI, inject, dependency, container, provider, service"
description: "Dependency injection — ne zaman, nasıl"
---

# Dependency Injection

## Ne zaman kullan

- Servis sınıfı başka bir servise ihtiyaç duyduğunda (DB, HTTP client, logger)
- Test'te mock istediğin her yerde
- Bir sınıfı global durumdan (singleton) ayırmak istediğinde

## Ne zaman kullanma

- Tek kullanımlık pure function için (over-engineering)
- Stateless helper'lar (`capitalize`, `formatDate`) — export et, inject etme

## Temel prensip

Bir sınıf bağımlılığını **constructor'dan al**, kendi içinde `new` ile oluşturma:

### Kötü (tight coupling)
```typescript
class UserService {
  private db = new MongoClient(...); // direkt bağımlı

  async getUser(id: string) {
    return this.db.users.findOne({ id });
  }
}
```

Test'te MongoClient mock'layamazsın; prod DB'ye bağlanmaya çalışır.

### İyi (constructor injection)
```typescript
class UserService {
  constructor(private readonly db: DatabaseClient) {}

  async getUser(id: string) {
    return this.db.users.findOne({ id });
  }
}
```

Test'te `new UserService(mockDb)` — istediğin mock'u geçir.

## Framework'e göre

### NestJS (backend profile)
Built-in DI container:
```typescript
@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private readonly logger: Logger,
  ) {}
}
```

### React (frontend profile)
- Props veya context üzerinden
- Hook factory pattern: `useUserService(apiClient)`
- Runtime DI container (InversifyJS, tsyringe) nadir — genelde gereksiz

### Vanilla TypeScript
- Constructor injection (yukarıdaki örnek)
- Inversion of Control container (tsyringe): büyük app'lerde iyi

## Interface segregation

Dependency'yi **interface ile iste**, concrete class ile değil:

```typescript
interface UserRepository {
  findOne(id: string): Promise<User | null>;
  save(user: User): Promise<User>;
}

class UserService {
  constructor(private readonly userRepo: UserRepository) {}
}

// MongoDB impl
class MongoUserRepository implements UserRepository { ... }

// Test impl
class InMemoryUserRepository implements UserRepository { ... }
```

Service artık hangi DB'yi bilmiyor. Swap edilebilir.

## Anti-pattern'ler

**Service locator**
```typescript
class UserService {
  getUser(id: string) {
    const db = ServiceLocator.get('db'); // hidden dependency
  }
}
```
Dependency gizli — constructor'dan görünmüyor. Test ve refactor zor.

**Circular dependency**
A → B → A. Framework'ler algılar ama uyarı verir. Çözüm: ortak bir C servise çıkar, ya da event-based.

**God container**
Her şey container'dan gelir. 500 service, hepsi birbirini inject eder. Çözüm: bounded context'lere böl.

**Test'te DI bypass**
```typescript
// service.ts
class UserService {
  private db: Database; // private!
  constructor() {
    this.db = new RealDatabase();
  }
}

// test.ts
const svc = new UserService();
(svc as any).db = mockDb; // privacy ihlali
```
Doğrusu: constructor'a mock geçir.

## Aksiyon

Yeni bir service yazarken:
1. Bağımlılıklarını listele (DB, HTTP, logger, config)
2. Her birini constructor parameter olarak kabul et
3. Interface tanımla (mümkünse)
4. Framework'ün DI sistemini kullan (NestJS @Injectable, vs.)
5. Test'te mock geçir, spy'larla doğrula

---

## Manuel DI vs DI Container kütüphanesi

### Manuel DI

```typescript
// di-container.ts — küçük/orta proje için yeterli
import { PrismaClient } from "@prisma/client";

class DIContainer {
  // Infrastructure (singletons)
  readonly prisma = new PrismaClient();
  readonly logger = pino();
  readonly flags = FeatureFlagService.getInstance();

  // Repositories
  readonly chatRepo = new PrismaChatRepository(this.prisma);
  readonly msgRepo = new PrismaMessageRepository(this.prisma);
  readonly userRepo = new PrismaUserRepository(this.prisma);

  // Strategies
  readonly streamingStrategy = new StreamingCompletionStrategy(this.aiService);
  readonly jsonStrategy = new JsonCompletionStrategy(this.aiService);

  // Services
  readonly aiService = new MockAIService();
  readonly completionFactory = new CompletionStrategyFactory(
    this.flags, this.streamingStrategy, this.jsonStrategy,
  );
  readonly chatService = new ChatService(
    this.chatRepo, this.msgRepo, this.completionFactory, this.flags,
  );

  // Controllers
  readonly chatController = new ChatController(this.chatService);
}

export const container = new DIContainer();
```

Routes:
```typescript
import { container } from "./di-container";

router.get("/api/chats", asyncHandler(container.chatController.listChats));
```

**Pros**:
- Sıfır bağımlılık
- Decorator metadata yok (TS config sade)
- Bağımlılık zinciri **dosyada görünür**, "büyü" yok
- Bundle size minimal

**Cons**:
- Her yeni provider için manuel ekleme
- Çok büyük projede dosya devasa olur (50+ provider)

### DI Container kütüphanesi (NestJS, tsyringe, inversify)

```typescript
@Injectable()
export class ChatService {
  constructor(
    @Inject(IChatRepository) private chatRepo: IChatRepository,
    private msgRepo: MessageRepository,
    private completionFactory: CompletionStrategyFactory,
  ) {}
}

@Module({
  providers: [
    ChatService,
    { provide: IChatRepository, useClass: PrismaChatRepository },
    MessageRepository,
    CompletionStrategyFactory,
  ],
  controllers: [ChatController],
})
export class ChatModule {}
```

**Pros**:
- Auto-wiring (constructor type'lardan resolve)
- Module pattern (büyük proje için organize)
- Scope yönetimi (request/transient/singleton)

**Cons**:
- Decorator metadata gerek (`emitDecoratorMetadata: true`)
- Reflection-based — bundle size +
- "Büyü" — bağımlılık nereden geldi anlamak için container araması

### Karar matrisi

| Proje boyutu | Tavsiye |
|--------------|---------|
| <30 provider, tek developer | Manuel DI |
| Express + tek modül | Manuel DI |
| NestJS framework | NestJS native (zaten orada) |
| Microservice, 100+ provider | NestJS / inversify |
| Library | Manuel + named exports (tüketici container'ını kendi seçer) |

## Aksiyon (devamı)

6. Container'ı **tek dosyada** topla (`di-container.ts`)
7. Bağımlılık sırasını yorumla:
   ```
   // Infrastructure (singletons)
   // Repositories
   // External services
   // Strategies
   // Factories
   // Services
   // Controllers
   ```
8. Test'te alternatif container yarat (mock'larla)
9. NestJS kullanıyorsan native DI kullan, manuel container kurma
