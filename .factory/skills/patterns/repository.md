---
name: repository
keywords: "repository, data access, abstraction, DAL, persistence"
description: "Repository pattern — DB erişiminin soyutlanması, business logic sınırı"
---

# Repository Pattern

Veritabanı erişimini, geri kalan koddan **soyutlamak** için.

## Üç fayda

### 1. Business logic temiz kalır

Service dosyasını açtığında **iş kuralları** görürsün, SQL/Prisma sorguları değil:

```typescript
// service.ts — okunabilir
async listChats(userId: string) {
  const limit = this.flags.get("PAGINATION_LIMIT");
  return this.repo.findByUserId(userId, { limit });
}
```

vs.

```typescript
// service.ts — sıkı bağlı
async listChats(userId: string) {
  const limit = this.flags.get("PAGINATION_LIMIT");
  return this.prisma.chat.findMany({
    where: { userId, deletedAt: null },
    take: limit,
    orderBy: { createdAt: "desc" },
    include: { lastMessage: true },
  });
}
```

İlki "ne yapıyor?" sorusuna cevap verir. İkincisi "nasıl yapıyor?" karışıklığı.

### 2. DB değişimi kolay

PostgreSQL → MongoDB geçişi:

```typescript
// Önce
class PrismaUserRepository implements IUserRepository { /* ... */ }

// Sonra (yeni dosya)
class MongoUserRepository implements IUserRepository {
  constructor(private mongo: MongoClient) {}
  async findById(id: string): Promise<User | null> {
    return this.mongo.db().collection("users").findOne({ _id: id });
  }
}

// DI container'da değiştir — 1 satır
const repo: IUserRepository = new MongoUserRepository(mongo);
```

Service ve Controller dokunulmaz.

### 3. Test mock'lanabilir

```typescript
const mockRepo: IUserRepository = {
  findById: jest.fn().mockResolvedValue({ id: "u1", email: "a@b.c", role: "USER" }),
  create: jest.fn(),
};

const service = new UserService(mockRepo);
const result = await service.getProfile("u1");
expect(result.email).toBe("a@b.c");
```

DB hiç ayağa kalkmaz.

## Repository'nin sınırları

### Sınır 1: Sadece data getirir veya yazar

**Business kuralı uygulamaz.**

```typescript
// ❌ Repository'de business logic
class ChatRepository {
  async findByUserId(userId: string, user: User) {
    if (user.role === "premium") {
      return this.prisma.chat.findMany({ where: { userId }, take: 100 });
    }
    return this.prisma.chat.findMany({ where: { userId }, take: 10 });
  }
}
```

`if (user.role === "premium")` business kuralı. Repository bilmemeli.

```typescript
// ✓ Service karar verir
class ChatService {
  async listChats(userId: string, user: User) {
    const limit = user.role === "premium" ? 100 : 10;
    return this.repo.findByUserId(userId, { limit });
  }
}

class ChatRepository {
  async findByUserId(userId: string, opts: { limit: number }) {
    return this.prisma.chat.findMany({ where: { userId }, take: opts.limit });
  }
}
```

Repository "şu user için, şu limitle, şu cursor'dan sonra getir" der. **Karar service'te.**

### Sınır 2: Yetki kontrolü repository'de yapılmaz

```typescript
// ❌ Repository "bu user'a ait mi?" diye soruyor
class ChatRepository {
  async findById(chatId: string, currentUserId: string) {
    const chat = await this.prisma.chat.findUnique({ where: { id: chatId } });
    if (chat?.userId !== currentUserId) {
      throw new ForbiddenError();        // ← yetki kararı
    }
    return chat;
  }
}
```

Yetki = business kuralı.

```typescript
// ✓ Repository sadece "var mı?" döner
class ChatRepository {
  async findByIdAndUserId(chatId: string, userId: string): Promise<Chat | null> {
    return this.prisma.chat.findFirst({
      where: { id: chatId, userId },     // ← filter, yetki değil "scoped query"
    });
  }
}

// Service karar verir
class ChatService {
  async getChat(chatId: string, currentUserId: string) {
    const chat = await this.repo.findByIdAndUserId(chatId, currentUserId);
    if (!chat) throw new NotFoundError("Chat not found");
    return chat;
  }
}
```

Repository **scoped query** yapar (filter ile sınırlı). Karar service'te.

**Bonus güvenlik**: Repository imzası `findById(id, userId)` zorunlu olunca, service unutsa bile ihlal olmaz. Bu **fail-safe** tasarımdır.

### Sınır 3: Pagination'ın "ne kadar"ı service'in sorunu

```typescript
// Repository "mekanik" pagination
class ChatRepository {
  async findByUserId(userId: string, opts: { limit: number; cursor?: string }) {
    const items = await this.prisma.chat.findMany({
      where: { userId },
      take: opts.limit,
      cursor: opts.cursor ? { id: opts.cursor } : undefined,
      skip: opts.cursor ? 1 : 0,
      orderBy: { createdAt: "desc" },
    });
    return items;
  }
}
```

Service söyler "ne kadar":

```typescript
class ChatService {
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

`+1 oku` tekniği — limit+1 al, hasMore'u tek sorguda tespit et.

## Interface bazlı tasarım

```typescript
// 1. Interface (sözleşme)
export interface IChatRepository {
  findByUserId(userId: string, opts: PaginationOpts): Promise<Chat[]>;
  findByIdAndUserId(chatId: string, userId: string): Promise<Chat | null>;
  create(data: CreateChatInput): Promise<Chat>;
  delete(chatId: string, userId: string): Promise<void>;
}

// 2. Implementation
export class PrismaChatRepository implements IChatRepository {
  constructor(private prisma: PrismaClient) {}
  // ... implementation
}

// 3. Service interface'i alır
export class ChatService {
  constructor(private repo: IChatRepository) {}     // ← interface
}

// 4. DI container birleştirir
const chatRepo: IChatRepository = new PrismaChatRepository(prisma);
const chatService = new ChatService(chatRepo);
```

## Repository method naming

```typescript
interface IUserRepository {
  // Query (find/get)
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findManyByOrgId(orgId: string, opts: PaginationOpts): Promise<User[]>;

  // Existence check
  existsByEmail(email: string): Promise<boolean>;

  // Mutation
  create(data: CreateUserInput): Promise<User>;
  update(id: string, data: UpdateUserInput): Promise<User>;
  delete(id: string): Promise<void>;

  // Bulk
  bulkInsert(users: CreateUserInput[]): Promise<void>;
  countByOrgId(orgId: string): Promise<number>;
}
```

Convention:
- `find*` — null döndürebilir
- `get*` — bulunamazsa throw
- `exists*` — boolean
- `create/update/delete` — mutation

## Repository ne YAPMAZ?

| Yapar | Yapmaz |
|-------|--------|
| Prisma sorgusu | Business kuralı |
| Filter, sort, paginate | "Premium mu?" kontrolü |
| Cascade DB-level (Prisma `onDelete`) | Cascade business-level |
| Default values (DB schema) | Default business values |
| Raw query (gerekiyorsa) | API çağrısı |
| Transaction wrapper | Email/SMS/Push trigger |
| Scoped query (`WHERE userId`) | Yetki kararı |

## Multiple repositories per entity?

Genelde gerek yok. Tek `IUserRepository` 8-10 method ile çoğu use case'i karşılar.

İstisnalar:
- **Read-heavy + write-heavy ayrışması** (CQRS) — `IUserReadRepository` + `IUserWriteRepository`
- **Cache vs DB** — `ICachedUserRepository` decorator pattern: cache miss'te DB'ye git
- **Search** — `IUserSearchRepository` (Elasticsearch için ayrı)

## Yapma

- Repository içinde `if (user.role === ...)` benzeri business
- Service'i bypass edip controller'dan repository çağırmak
- Repository'de HTTP çağrısı (yeni kaynak için ayrı `APIClient` veya `Service`)
- Repository'de logger'a "user.created" iş event'i atmak — domain event service'in sorumluluğu
- Generic `BaseRepository<T>` 5 yöntem ile başlamak — ilk implementasyonda concrete yaz, pattern'ı görünce extract et
- Repository'de validation — DTO/zod controller'dan önce validate eder
- Repository'de `req.user` — service söyler, repo bilmez
