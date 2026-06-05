---
name: layered-architecture
keywords: "layer, layered, architecture, controller, service, repository, dependency direction, katman"
description: "Katmanlı mimari — sorumluluk dağılımı, bağımlılık yönü, veri akışı"
---

# Layered Architecture

Sistem 6 katman. Her katmanın **kendi kelime dağarcığı** ve **konuşabildiği komşu katmanları** var.

## Katmanlar (yukarıdan aşağıya)

```
┌─────────────────────────────────────────┐
│ 1. Routing               URL → handler │
├─────────────────────────────────────────┤
│ 2. Middleware            filter, enrich│
├─────────────────────────────────────────┤
│ 3. Controller            HTTP ↔ domain │
├─────────────────────────────────────────┤
│ 4. Service               business rules│
├─────────────────────────────────────────┤
│ 5. Repository            data access   │
├─────────────────────────────────────────┤
│ 6. Infrastructure        DB, log, config│
└─────────────────────────────────────────┘
```

## Katman 1 — Routing

**URL'i, doğru middleware zincirine ve doğru controller metoduna yönlendirir.**

İş mantığı YOK. Sadece tablo:

```typescript
// routes.ts
router.get(
  "/api/chats",
  authMiddleware,
  rateLimitMiddleware("list"),
  validateQuery(listChatsSchema),
  asyncHandler(controller.listChats),
);
```

## Katman 2 — Middleware

**İsteği kontrol eder, dönüştürür veya engeller.**

Her middleware **tek bir sorumluluk**: auth, validation, rate limit, FF check, vs.

```typescript
// auth.middleware.ts
export async function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) throw new UnauthorizedError("No token");

  const payload = jwt.verify(token, env.JWT_SECRET);
  req.user = { id: payload.sub };
  next();
}
```

Controller'a ulaşan istek = **geçerli ve zenginleştirilmiş**.

## Katman 3 — Controller

**HTTP request'ten parametreleri okur, service'i çağırır, sonucu HTTP response'a dönüştürür.**

Business logic YOK. Sadece "iletişim çevirmenliği".

```typescript
// chat.controller.ts
class ChatController {
  constructor(private service: ChatService) {}

  async listChats(req, res) {
    const userId = req.user.id;
    const cursor = req.query.cursor as string | undefined;

    const result = await this.service.listChats(userId, cursor);

    res.json({ success: true, ...result });
  }
}
```

## Katman 4 — Service

**İş kurallarını uygular.** Repository'leri ve strategy'leri orkestralı kullanır.

```typescript
// chat.service.ts
class ChatService {
  constructor(
    private repo: IChatRepository,
    private flags: IFeatureFlagService,
  ) {}

  async listChats(userId: string, cursor?: string) {
    const limit = this.flags.get("PAGINATION_LIMIT");

    const items = await this.repo.findByUserId(userId, { limit: limit + 1, cursor });

    const hasMore = items.length > limit;
    const data = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    return { data, nextCursor, hasMore };
  }
}
```

`req`/`res` bilmez. Sadece "ne yapmam gerekiyor?" sorusuna cevap verir.

## Katman 5 — Repository

**Veritabanı ile konuşur.** SQL/Prisma sorguları **sadece burada**.

```typescript
// chat.repository.ts
class PrismaChatRepository implements IChatRepository {
  constructor(private prisma: PrismaClient) {}

  async findByUserId(userId: string, opts: { limit: number; cursor?: string }) {
    return this.prisma.chat.findMany({
      where: { userId },
      take: opts.limit,
      cursor: opts.cursor ? { id: opts.cursor } : undefined,
      skip: opts.cursor ? 1 : 0,
      orderBy: { createdAt: "desc" },
    });
  }
}
```

Business kuralı bilmez. "Premium kullanıcı için kaç chat" gibi soruyu cevaplamaz — service söyler, repo uygular.

## Katman 6 — Infrastructure

**DB client, Logger, Config, FF service.** Singleton'lar.

Her katman bunlardan yararlanır ama hiçbiri bunları **yönetmez**.

## Bağımlılık yönü kuralı

```
Route → Middleware → Controller → Service → Repository → DB
                                     ↓
                               Strategy / Factory
```

**Tek yönlü.** Repository → Service ÇAĞIRAMAZ. Service → Controller ÇAĞIRAMAZ.

### İhlal örnekleri

```typescript
// ❌ Repository, service'i çağırıyor
class ChatRepository {
  async findById(id: string) {
    const chat = await this.prisma.chat.findUnique({ where: { id } });
    if (chat) {
      this.notificationService.notify(chat.userId, "viewed");   // ← SERVİSE BAĞIMLI
    }
    return chat;
  }
}
```

```typescript
// ❌ Service, response yazıyor
class ChatService {
  async listChats(userId: string, res: Response) {              // ← res aldı
    const items = await this.repo.findByUserId(userId);
    res.json(items);                                             // ← HTTP yazıyor
  }
}
```

## Inversion of Control (IoC)

Üst katman, alt katmanı **`new` ile yaratmaz** — dışarıdan alır.

### Geleneksel (kötü)

```typescript
class ChatService {
  private repo = new ChatRepository();   // ← service, repo'yu yarattı
}
```

Test ederken DB'yi de ayağa kaldırmak gerek.

### IoC (doğru)

```typescript
class ChatService {
  constructor(private repo: IChatRepository) {}   // ← dışarıdan
}

// DI container
const repo: IChatRepository = new PrismaChatRepository(prisma);
const service = new ChatService(repo);
```

Test'te:
```typescript
const mockRepo: IChatRepository = { findByUserId: jest.fn().mockResolvedValue([...]) };
const service = new ChatService(mockRepo);
```

DB hiç ayağa kalkmaz. Test milisaniye.

## Veri akışının anatomisi

### GET /api/chats

```
1. Express router → middleware zinciri
2. authMiddleware: JWT decode → req.user = { id }
3. rateLimitMiddleware: bucket check
4. validateQuery: ?cursor=xxx zod parse
5. controller.listChats:
   - req.user.id, req.query.cursor oku
   - service.listChats(userId, cursor) çağır
6. service.listChats:
   - flags.get("PAGINATION_LIMIT") oku
   - repo.findByUserId(userId, { limit, cursor }) çağır
7. repo.findByUserId:
   - Prisma sorgusu, items dön
8. service: hasMore + nextCursor hesapla, dön
9. controller: { success, data, nextCursor, hasMore } JSON
10. response client'a
```

Her katman **tek sorumluluğunu** yerine getirdi.

### POST /api/completion (streaming)

```
1-7. Aynı (auth, validation, controller, service)
8. service.complete:
   - history çek (repo)
   - factory.create(STREAMING_ENABLED) → strategy
   - strategy.execute({ message, history, response })
9. strategy:
   - StreamingStrategy: AI service.streamCompletion()
   - res.write(chunk) — chunk chunk SSE
   - bittiğinde repo.save(assistantMessage)
10. response stream client'a
```

Controller, `STREAMING_ENABLED`'i bilmez. Strategy + Factory ayırdı.

## Mimari sinyaller (kötü kokular)

| Sinyal | Anlam | Çözüm |
|--------|-------|-------|
| `if (featureFlag.X)` controller'da | OCP ihlali | Strategy + Factory |
| `req`/`res` service'de | Layer ihlali | Service'ten çıkar |
| Prisma query repository dışında | Repository ihlali | Repo'ya taşı |
| `new Service()` controller'da | DI ihlali | Constructor injection |
| `if (user.role === "premium")` repository'de | Business logic ihlali | Service'e taşı |
| 3+ kattan birden fazla data sızdırma | Sıkı bağımlılık | DTO/projection ekle |

## Yapma

- Katmanları "esnek" tutmak için karıştırmak — disiplin = sürdürülebilirlik
- Her küçük şey için yeni katman — 6 katman max, ekleme yapma
- Service'i "fat" yapıp repository'yi "thin" tutmak yerine business logic'i karıştırmak
- Generic `BaseService<T>`/`BaseController<T>` yapmak — gerçek kullanım pattern'ı oluştuğunda soyutla
- Layer pattern'ı sadece backend için sanmak — frontend'de de Container/Hook/Component aynı disiplini ister
