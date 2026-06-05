---
name: anti-patterns
keywords: "anti-pattern, tuzak, mistake, kötü, smell, code smell, refactor"
description: "15 yaygın mimari tuzak — tespit + refactor"
---

# Anti-Patterns (Yaygın Tuzaklar)

Her birinin **belirtisi**, **nedeni**, **refactor yolu**.

## 1. Controller'da `if (featureFlag)`

### Belirti
```typescript
async complete(req, res) {
  if (this.flags.get("STREAMING_ENABLED")) {
    // 30 satır SSE
  } else {
    // 10 satır JSON
  }
}
```

### Neden kötü
OCP ihlali. Yeni mod (örn: WebSocket) = controller'ı aç + `else if`. Test = controller'ı tüm modlarda dene.

### Refactor → Strategy + Factory
```typescript
async complete(req, res) {
  const strategy = this.factory.create();   // FF'e bakar
  await strategy.execute({ message: req.body.message, response: res });
}
```

`patterns/strategy.md` + `patterns/factory.md`.

---

## 2. Service'in HTTP nesnelerine erişmesi

### Belirti
```typescript
class ChatService {
  async listChats(req: Request, res: Response) {
    const userId = (req as any).user.id;
    res.json({ data: await this.repo.findByUserId(userId) });
  }
}
```

### Neden kötü
Service test'inde `req`/`res` mock'lamak gerek. Service HTTP framework'üne bağımlı oldu (Express → Fastify geçişi = service değişir).

### Refactor → Domain values
```typescript
class ChatService {
  async listChats(userId: string, cursor?: string): Promise<ListResult> {
    return this.repo.findByUserId(userId, { cursor });
  }
}

class ChatController {
  async listChats(req, res) {
    const result = await this.service.listChats(req.user.id, req.query.cursor);
    res.json({ success: true, ...result });
  }
}
```

**İstisna**: Streaming için `res` parametresi gerekli — context object'in bir field'ı olarak geçer, documented.

---

## 3. Repository'de business logic

### Belirti
```typescript
class ChatRepository {
  async findByUserId(userId: string, user: User) {
    if (user.role === "premium") {
      return this.prisma.chat.findMany({ where: { userId }, take: 100 });
    }
    return this.prisma.chat.findMany({ where: { userId }, take: 10 });
  }
}
```

### Neden kötü
Repository'nin tek sorumluluğu kırıldı. "Premium kuralı" değişirse repo değişir, business kodu okunmaz hale gelir.

### Refactor → Karar service'te
```typescript
class ChatRepository {
  async findByUserId(userId: string, opts: { limit: number }) {
    return this.prisma.chat.findMany({ where: { userId }, take: opts.limit });
  }
}

class ChatService {
  async listChats(userId: string, user: User) {
    const limit = user.role === "premium" ? 100 : 10;
    return this.repo.findByUserId(userId, { limit });
  }
}
```

---

## 4. Singleton'ı her yerde kullanmak

### Belirti
```typescript
class UserService {
  private static instance: UserService;
  static getInstance() { /* ... */ }
}

class UserRepository {
  private static instance: UserRepository;
}
```

### Neden kötü
Test mock'lamak çok zor (static field). Bağımlılık gizli (constructor parametresi yok). State sızıntısı (test'ler arası).

### Refactor → Singleton sadece infrastructure
```typescript
// Singleton OK
const prisma = new PrismaClient();          // DB
const logger = pino();                       // Logger
const flags = FeatureFlagService.getInstance();  // FF

// Singleton DEĞİL
class UserService {
  constructor(
    private repo: IUserRepository,
    private flags: IFeatureFlagService,
  ) {}
}
```

`patterns/singleton.md`.

---

## 5. Validation'ı controller'da yapmak

### Belirti
```typescript
async createUser(req, res) {
  if (!req.body.email) return res.status(400).json({ error: "Email required" });
  if (!req.body.password) return res.status(400).json({ error: "Password required" });
  if (req.body.password.length < 8) return res.status(400).json({ error: "Too short" });
  // ... business logic
}
```

### Neden kötü
Tekrar (her endpoint'te benzer). Hata kaynağı (test edilmemiş edge case). Controller şişer.

### Refactor → zod + middleware
```typescript
// schemas/create-user.schema.ts
export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

// middleware/validate.ts
export function validateBody(schema: ZodSchema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(new ValidationError("Invalid body", result.error.flatten()));
    }
    req.body = result.data;
    next();
  };
}

// route
router.post("/users", validateBody(createUserSchema), asyncHandler(controller.createUser));

// controller
async createUser(req, res) {
  const user = await this.service.createUser(req.body);   // valid varsayımı
  res.json({ success: true, data: user });
}
```

---

## 6. Middleware sırasını karıştırmak

### Belirti
```typescript
router.use(rateLimitMiddleware);    // ← rate limit
router.use(authMiddleware);          // ← sonra auth
router.use(appCheckMiddleware);     // ← sonra app check
```

### Neden kötü
Auth'tan **önce** rate limit yapmak — geçersiz isteklerin de bucket tüketmesine yol açar (attacker faydası).
App check'ten **önce** JWT decode etmek — bot'lara CPU yakar.

### Refactor → Doğru sıralama
```typescript
1. requestLogger        // her şeyden önce, kayıt
2. appCheck             // bot/spam filtresi
3. authMiddleware       // kim sorusu
4. clientType           // bilgi zenginleştirme
5. rateLimit            // route-specific, gerçek kullanıcı bazlı
6. featureFlagCheck     // route-specific
7. validateRequest      // zod
8. controller           // iş
9. errorHandler         // 4-arg, sona
```

`architecture/middleware-chain.md` (backend).

---

## 7. Hata format tutarsızlığı

### Belirti
```typescript
// Endpoint A
res.status(400).json({ error: "Invalid" });

// Endpoint B
res.status(400).json({ message: "Invalid", code: 400 });

// Endpoint C
res.status(400).json({ errors: ["Invalid"] });
```

### Neden kötü
Frontend her endpoint için ayrı handler yazar. i18n imkansız. Logging araması imkansız.

### Refactor → Tek format + global error handler
```typescript
// Tek shape
type ApiError = {
  success: false;
  error: { code: string; message: string; details?: unknown };
};

// Custom error sınıfları
class ValidationError extends BaseError {
  statusCode = 400;
  code = "VALIDATION_ERROR";
}

// Global handler (4-arg)
app.use((err, req, res, next) => {
  if (err instanceof BaseError) {
    return res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message, details: err.details },
    });
  }
  // unknown error
  logger.error(err);
  res.status(500).json({
    success: false,
    error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
  });
});
```

`architecture/error-handling.md` (backend).

---

## 8. Logger'ı `console.log` ile karıştırmak

### Belirti
```typescript
async createUser(data) {
  console.log("Creating user", data);
  const user = await this.repo.create(data);
  console.log("User created", user.id);
  this.logger.info("user.created", { userId: user.id });   // ← inconsistent
}
```

### Neden kötü
`console.log` structured log JSON yapısını bozar. Production log aggregator (Datadog, Loki) parse edemez. Sensitive data sanitize edilmez.

### Refactor → Tek logger
```typescript
async createUser(data) {
  this.logger.debug("Creating user", { email: data.email });
  const user = await this.repo.create(data);
  this.logger.info("user.created", { userId: user.id });
}
```

`console.*` sadece debug script'lerinde — production kodunda **hiç**.

---

## 9. SSE'yi unutup buffer'lı response göndermek

### Belirti
```typescript
async streamCompletion(req, res) {
  res.setHeader("Content-Type", "text/event-stream");
  // res.flushHeaders() YOK

  for await (const chunk of stream) {
    res.write(`data: ${chunk}\n\n`);
  }
  res.end();
}
```

### Neden kötü
Default Express response buffering ilk chunk'ı geciktirir. Reverse proxy (Nginx) `proxy_buffering on` ise tüm response biriktirir, "stream" özelliği yok olur.

### Refactor → Explicit flush
```typescript
async streamCompletion(req, res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();                              // ← şart

  for await (const chunk of stream) {
    res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
  }
  res.write("event: done\ndata: \n\n");
  res.end();
}
```

Nginx config: `proxy_buffering off; proxy_cache off;`

Test: `curl -N http://localhost:3000/api/stream` — chunk'lar gerçekten gerçek zamanlı geliyor mu.

---

## 10. Graceful shutdown unutmak

### Belirti
Container durdurulunca app aniden ölür. DB bağlantıları "asılı kalır", sonraki başlangıçta "too many connections" hatası.

### Refactor → SIGTERM handler
```typescript
async function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down gracefully`);

  server.close(async () => {
    await prisma.$disconnect();
    await redis.quit();
    logger.info("Cleanup done, exiting");
    process.exit(0);
  });

  // Force exit after 30s
  setTimeout(() => {
    logger.error("Forced exit after timeout");
    process.exit(1);
  }, 30_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
```

NestJS: `app.enableShutdownHooks()` + `OnModuleDestroy` lifecycle.

---

## 11. .env dosyasını commit etmek

### Belirti
```bash
$ git log --all -- .env
commit abc123
+ JWT_SECRET=production-real-key
+ DATABASE_URL=postgresql://prod...
```

### Neden kötü
Repo public veya breach olursa secret leak. JWT secret'ı bilen herkes token üretir. Git history'den silmek **çok zor** (filter-branch + force-push, hala mirror'larda kalır).

### Refactor
```bash
# .gitignore — kesinlikle
.env
.env.local
.env.production

# .env.example — repo'da var
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname
JWT_SECRET=change-me-min-16-chars
```

Eğer kazara commit edildiyse:
1. **Hemen secret'ları rotate et** (eskisi compromised)
2. `git filter-repo` ile history'den temizle
3. Force push (mirror'lar kalır, **secret rotation şart**)

---

## 12. Pagination'da iki sorgu (COUNT + SELECT)

### Belirti
```typescript
async listChats(userId: string, page: number, limit: number) {
  const total = await this.prisma.chat.count({ where: { userId } });   // ← 1. sorgu
  const items = await this.prisma.chat.findMany({
    where: { userId }, skip: page * limit, take: limit,
  });                                                                    // ← 2. sorgu
  return { total, items, hasMore: page * limit + items.length < total };
}
```

### Neden kötü
- COUNT büyük tablo'da YAVAŞ (full table scan).
- OFFSET büyüdükçe yavaşlar.
- Yeni kayıt eklenirse sayfa kayar.

### Refactor → +1 oku tekniği (cursor)
```typescript
async listChats(userId: string, cursor?: string, limit = 20) {
  const items = await this.prisma.chat.findMany({
    where: { userId },
    take: limit + 1,                                  // ← +1
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : 0,
    orderBy: { createdAt: "desc" },
  });

  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore ? data[data.length - 1].id : null;

  return { data, nextCursor, hasMore };
}
```

**Tek sorgu** ile hasMore tespit. `prisma/queries.md`.

---

## 13. Sahiplik kontrolünü unutmak

### Belirti
```typescript
async getChat(req, res) {
  const chat = await this.repo.findById(req.params.id);     // ← user filter YOK
  res.json({ success: true, data: chat });
}
```

### Neden kötü
Başka kullanıcının chat'ine ID ile erişim. **OWASP Top 10 — Broken Access Control.**

### Refactor → Repository imzasında zorla
```typescript
// Repository
async findByIdAndUserId(chatId: string, userId: string): Promise<Chat | null> {
  return this.prisma.chat.findFirst({
    where: { id: chatId, userId },        // ← scoped query
  });
}

// Service
async getChat(chatId: string, userId: string) {
  const chat = await this.repo.findByIdAndUserId(chatId, userId);
  if (!chat) throw new NotFoundError("Chat not found");   // 404 — bilgi sızdırmaz
  return chat;
}

// Controller
async getChat(req, res) {
  const chat = await this.service.getChat(req.params.id, req.user.id);
  res.json({ success: true, data: chat });
}
```

`findByIdAndUserId` imzası — service unutsa bile compile-time hata.

---

## 14. Decorator tabanlı DI kütüphanesi (küçük proje için)

### Belirti
```bash
# Express + 5 controller projesi
$ pnpm add tsyringe inversify reflect-metadata
$ # tsconfig: experimentalDecorators, emitDecoratorMetadata
$ # constructor injection: @inject(Symbol.for("UserRepo"))
```

### Neden kötü
Decorator metadata bundle'a +50KB. Reflection runtime cost. Symbol-based token'lar refactor zor. Öğrenme eğrisi var.

### Refactor → Manuel DI
```typescript
// di-container.ts (1 dosya, tüm wiring)
const prisma = new PrismaClient();
const userRepo = new UserRepository(prisma);
const userService = new UserService(userRepo);
const userController = new UserController(userService);

export const container = { userController, /* ... */ };
```

`patterns/dependency-injection.md` — manuel vs container karşılaştırması.

**İstisna**: NestJS kullanıyorsan zaten orada — kullan. Express'te tsyringe getirme.

---

## 15. README'yi son güne bırakmak

### Belirti
- "Setup adımları nedir?" cevap yok
- "Hangi env değişkenleri gerekli?" .env.example yok
- "Nasıl çalıştırırım?" `package.json` script'leri belirsiz

### Neden kötü
Yeni developer (veya değerlendirici) ilk 30 saniyede sistemi ayağa kaldıramaz. **İlk izlenim** olumsuz olur — kalanı ne kadar iyi olursa olsun şüpheyle bakılır.

### Refactor → README disiplini
```markdown
# Project Name

> Tek cümle açıklama

## Quick Start

```bash
git clone ...
cd project
cp .env.example .env
# .env'i düzenle (DATABASE_URL, JWT_SECRET)
docker compose up -d postgres
pnpm install
pnpm prisma migrate deploy
pnpm dev
```

Sistem `http://localhost:3000`'de çalışır.

## Environment Variables

| Var | Required | Default | Description |
|-----|----------|---------|-------------|
| DATABASE_URL | yes | - | postgresql://... |
| JWT_SECRET | yes | - | min 16 char |
| PORT | no | 3000 | HTTP port |

## Endpoints
... (kısa liste)

## Architecture
Bkz. ARCHITECTURE.md
```

İlk commit'te oluştur, her özellik eklendikçe güncelle. Son güne bırakırsan, panic mode'da yazılır = eksik + hatalı.

---

## Kontrol checklist (commit öncesi)

```
□ Controller'da if(featureFlag) yok
□ Service req/res almıyor
□ Repository'de business logic yok (if user.role gibi)
□ Service / Repository Singleton değil
□ Validation middleware seviyesinde
□ Middleware sırası doğru
□ Hata formatı tek
□ console.log yok (logger.X kullanılıyor)
□ SSE flushHeaders var
□ Graceful shutdown handler var
□ .env commit'lenmedi (.gitignore kontrol)
□ Pagination tek sorgu (+1 oku veya cursor)
□ Sahiplik kontrolü repo imzasında zorlanmış
□ DI manuel veya framework native (decorator lib gereksiz)
□ README setup + env tablosu güncel
```

`architecture-reviewer` agent'ı bu listeyi otomatik tarar.
