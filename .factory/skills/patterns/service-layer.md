---
name: service-layer
keywords: "service, business logic, domain, application, use case"
description: "Service layer — iş kurallarının konumu, HTTP'den habersiz olma kuralı"
---

# Service Layer

İş kurallarının yaşadığı yer.

## Service ne yapar?

### 1. Yetki kontrolü

```typescript
async getChat(chatId: string, currentUserId: string) {
  const chat = await this.repo.findByIdAndUserId(chatId, currentUserId);
  if (!chat) throw new NotFoundError("Chat not found");
  return chat;
}
```

`findByIdAndUserId` ile scoped query — başka kullanıcının chat'i için **null döner**, "yok" ile "yok ama senin değil" aynı sonucu verir (bilgi sızdırmaz).

### 2. Feature flag yorumlama

```typescript
async listChats(userId: string, cursor?: string) {
  const limit = this.flags.get("PAGINATION_LIMIT");
  return this.repo.findByUserId(userId, { limit, cursor });
}
```

Service flag'i okur, repo'ya **parametre** olarak geçirir. Repository flag varlığını bile bilmez.

### 3. Strategy seçimi orkestrası

```typescript
async complete(userId: string, chatId: string, message: string, res: Response) {
  // user message'ı kaydet
  await this.msgRepo.create({ chatId, role: "user", content: message });

  // history çek
  const history = await this.msgRepo.findByChatId(chatId, { limit: 20 });

  // strategy seç
  const strategy = this.completionFactory.create();   // FF'e bakar

  // execute
  const fullResponse = await strategy.execute({ message, history, res });

  // assistant message'ı kaydet
  await this.msgRepo.create({ chatId, role: "assistant", content: fullResponse });
}
```

Service orkestralar — repository, factory, strategy hep yardımcılar.

### 4. Veri dönüşümü

```typescript
async getProfile(userId: string): Promise<UserProfileDto> {
  const user = await this.repo.findById(userId);
  if (!user) throw new NotFoundError();

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt.toISOString(),
    // password, refreshTokenHash, mfaSecret intentionally omitted
  };
}
```

Sensitive field strip, Date → ISO string, computed field ekleme.

## Service'in sınırları

### Sınır 1: HTTP'yi bilmez

```typescript
// ❌ Service'de req/res
class ChatService {
  async listChats(req: Request, res: Response) {
    const userId = (req as any).user.id;
    const items = await this.repo.findByUserId(userId);
    res.json(items);
  }
}
```

Test ederken `req`/`res` mock'lamak gerek — ağrı.

```typescript
// ✓ Service domain ile konuşur
class ChatService {
  async listChats(userId: string, cursor?: string): Promise<ListChatsResult> {
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

Controller HTTP'yi konuşur, service domain'i.

**İstisna**: Streaming için `res` parametresi geçilebilir, ama bu özel ve documented.

### Sınır 2: DB sorgularını bilmez

```typescript
// ❌ Service'de Prisma
class UserService {
  constructor(private prisma: PrismaClient) {}

  async getUser(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }
}
```

DB değişimi → service değişir. Test'te DB ayağa kaldırırsın.

```typescript
// ✓ Repository üzerinden
class UserService {
  constructor(private repo: IUserRepository) {}

  async getUser(id: string) {
    return this.repo.findById(id);
  }
}
```

### Sınır 3: External API'leri direkt çağırmaz (genelde)

```typescript
// ❌ Service'de Stripe SDK direkt
class OrderService {
  async place(orderData: OrderInput) {
    const order = await this.repo.create(orderData);
    const stripe = new Stripe(process.env.STRIPE_KEY);
    await stripe.charges.create({ /* ... */ });        // ← external API direkt
    return order;
  }
}
```

```typescript
// ✓ Adapter pattern
interface IPaymentGateway {
  charge(amount: number, customerId: string): Promise<PaymentResult>;
}

class StripeGateway implements IPaymentGateway { /* ... */ }

class OrderService {
  constructor(
    private repo: IOrderRepository,
    private payment: IPaymentGateway,
  ) {}

  async place(orderData: OrderInput) {
    const order = await this.repo.create(orderData);
    await this.payment.charge(order.total, order.customerId);
    return order;
  }
}
```

Stripe → PayPal geçişi: yeni `PayPalGateway implements IPaymentGateway`. Service değişmez.

## Service ve Controller arasındaki sınır

**Kötü koku**: Controller'da iş kuralı.

```typescript
// ❌ Business logic controller'da
async completeChat(req, res) {
  const { chatId, message } = req.body;
  const userId = req.user.id;

  // Yetki kontrolü
  const chat = await this.chatRepo.findByIdAndUserId(chatId, userId);
  if (!chat) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  // Premium check
  if (req.user.role !== "premium" && message.length > 1000) {
    res.status(403).json({ error: "Premium only" });
    return;
  }

  // FF'e göre strategy
  if (this.flags.get("STREAMING_ENABLED")) {
    res.setHeader("Content-Type", "text/event-stream");
    // ... 30 satır streaming logic
  } else {
    const result = await this.ai.complete(message);
    await this.msgRepo.create({ chatId, role: "assistant", content: result });
    res.json({ success: true, data: result });
  }
}
```

3 ihlal: yetki controller'da, premium check controller'da, FF if/else controller'da.

```typescript
// ✓ Controller ince
async completeChat(req, res) {
  await this.service.complete({
    userId: req.user.id,
    userRole: req.user.role,
    chatId: req.body.chatId,
    message: req.body.message,
    response: res,                // streaming için
  });
}

// Service kalın (business logic)
class ChatService {
  async complete(input: CompleteInput) {
    await this.assertOwnership(input.chatId, input.userId);
    this.assertPremiumLimit(input.message, input.userRole);

    const strategy = this.factory.create();
    return strategy.execute(input);
  }
}
```

Controller "iletişim çevirmenliği". Service iş kararları.

## Service granularity

### Coarse-grained (kullan)

Bir use case = bir method.

```typescript
class ChatService {
  async listChats(userId: string, cursor?: string) { /* ... */ }
  async getChat(chatId: string, userId: string) { /* ... */ }
  async createChat(userId: string, title: string) { /* ... */ }
  async deleteChat(chatId: string, userId: string) { /* ... */ }
  async complete(input: CompleteInput) { /* ... */ }
}
```

Tek service = tek aggregate (Chat + ona bağlı Message).

### Fine-grained (kaçın)

```typescript
class ChatListService { /* ... */ }
class ChatGetService { /* ... */ }
class ChatCreateService { /* ... */ }
class ChatDeleteService { /* ... */ }
class CompleteService { /* ... */ }
```

5 dosya, her biri tek method. Pattern uğruna pattern. Aggregate yaklaşımı (DDD) tercih.

### Çok büyürse böl

ChatService 500+ satıra ulaştı? Domain'e göre böl:

```typescript
class ChatService { listChats, getChat, createChat, deleteChat }
class ChatCompletionService { complete, retry, cancel }
class ChatHistoryService { getHistory, exportHistory, archive }
```

## Service composition

Bir service başka bir service'i çağırabilir mi? **Evet, ama dikkatli.**

```typescript
class OrderService {
  constructor(
    private repo: IOrderRepository,
    private inventory: InventoryService,    // ← başka service
    private payment: IPaymentGateway,
    private notifications: NotificationService,
  ) {}

  async place(orderData: OrderInput) {
    await this.inventory.reserve(orderData.items);   // başka service
    const order = await this.repo.create(orderData);
    await this.payment.charge(order.total, order.customerId);
    await this.notifications.sendOrderConfirmation(order);    // başka service
    return order;
  }
}
```

OK — orkestratör pattern. Sadece **circular dependency** yok:
- ❌ OrderService → InventoryService → OrderService
- ✓ OrderService → InventoryService → InventoryRepository

Eğer dairesel bağımlılık çıkarsa, **3. bir service** (OrchestratorService) veya **event bus** ile çöz.

## Yapma

- Controller'da iş kuralı (yetki, FF, premium check, strategy seçimi)
- Service'de `req`/`res` (streaming istisnası hariç)
- Service'de `prisma.X.findMany()` direkt
- Service'de external API SDK direkt — gateway pattern
- Service'i Singleton yapmak — DI ile yönet
- Tek bir method için ayrı service sınıfı (over-engineering)
- Circular service dependency — event bus veya 3. service
- Service'de cache state field tutmak — race condition (cache repository veya decorator katmanına ait)
