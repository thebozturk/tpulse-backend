---
name: strategy
keywords: "strategy, pattern, runtime behavior, polymorphism, OCP"
description: "Strategy pattern — runtime davranış değişimi, if/else'in pattern'a dönüşümü"
---

# Strategy Pattern

Bir işin **birden fazla yapma yolu** olduğunda, hangi yolun seçileceği **runtime'da belirleniyor**sa.

## Ne zaman kullanılır?

### Kriter

| Soru | Cevap | Strategy? |
|------|-------|-----------|
| Aynı işi yapmanın 2+ yolu var mı? | Evet | ✓ |
| Hangi yolun seçileceği runtime'da mı? | Evet | ✓ |
| Yeni yol ekleme ihtimali var mı? | Evet | ✓✓ |
| `if/else` zinciri 3+ koşula çıkıyor mu? | Evet | ✓✓ |
| Davranış değişikliği farklı sınıflarda yayılmış mı? | Evet | ✓✓✓ |

3+ checkmark = Strategy pattern uygula.

### Kötü durum (Strategy ile çözülür)

```typescript
class ChatController {
  async complete(req, res) {
    const { message } = req.body;
    const userId = req.user.id;

    if (this.flags.get("STREAMING_ENABLED")) {
      // 30 satır SSE setup
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.flushHeaders();

      const stream = await this.ai.streamCompletion(message);
      let fullResponse = "";

      for await (const chunk of stream) {
        res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
        fullResponse += chunk;
      }
      res.write("event: done\ndata: \n\n");
      res.end();

      await this.repo.create({ role: "assistant", content: fullResponse });
    } else {
      // 10 satır JSON path
      const result = await this.ai.getCompletion(message);
      await this.repo.create({ role: "assistant", content: result });
      res.json({ success: true, data: { content: result } });
    }
  }
}
```

40 satır controller. Yarın "throttled streaming" eklemek = `else if`. Sonra "tool-enabled streaming" = başka `else if`. Ahtapot.

## Strategy ile çözüm

### 1. Interface — ortak sözleşme

```typescript
// strategies/completion.strategy.ts
export interface ICompletionStrategy {
  execute(ctx: CompletionContext): Promise<string>;
}

export interface CompletionContext {
  message: string;
  history: Message[];
  response: Response;       // streaming için
  userId: string;
}
```

### 2. Concrete implementations

```typescript
// strategies/streaming-completion.strategy.ts
export class StreamingCompletionStrategy implements ICompletionStrategy {
  constructor(private ai: IAIService) {}

  async execute(ctx: CompletionContext): Promise<string> {
    ctx.response.setHeader("Content-Type", "text/event-stream");
    ctx.response.setHeader("Cache-Control", "no-cache");
    ctx.response.flushHeaders();

    let fullResponse = "";
    const stream = this.ai.streamCompletion(ctx.message, ctx.history);

    for await (const chunk of stream) {
      ctx.response.write(`event: chunk\ndata: ${JSON.stringify({ content: chunk })}\n\n`);
      fullResponse += chunk;
    }

    ctx.response.write("event: done\ndata: \n\n");
    ctx.response.end();

    return fullResponse;
  }
}

// strategies/json-completion.strategy.ts
export class JsonCompletionStrategy implements ICompletionStrategy {
  constructor(private ai: IAIService) {}

  async execute(ctx: CompletionContext): Promise<string> {
    const result = await this.ai.getCompletion(ctx.message, ctx.history);
    ctx.response.json({ success: true, data: { content: result } });
    return result;
  }
}
```

Her strategy **kendi sınıfında**, kendi test'i.

### 3. Factory — runtime seçici

```typescript
// strategies/completion.factory.ts
export class CompletionStrategyFactory {
  constructor(
    private flags: IFeatureFlagService,
    private streaming: StreamingCompletionStrategy,
    private json: JsonCompletionStrategy,
  ) {}

  create(): ICompletionStrategy {
    if (this.flags.isEnabled("STREAMING_ENABLED")) {
      return this.streaming;
    }
    return this.json;
  }
}
```

Tek satır karar. Factory'nin tek sorumluluğu.

### 4. Service kullanır

```typescript
class ChatService {
  constructor(
    private factory: CompletionStrategyFactory,
    private msgRepo: IMessageRepository,
  ) {}

  async complete(input: CompleteInput) {
    await this.msgRepo.create({ chatId: input.chatId, role: "user", content: input.message });

    const history = await this.msgRepo.findByChatId(input.chatId, { limit: 20 });

    const strategy = this.factory.create();      // FF'e bakar, doğru olanı verir
    const fullResponse = await strategy.execute({ ...input, history });

    await this.msgRepo.create({ chatId: input.chatId, role: "assistant", content: fullResponse });
  }
}
```

Service hangi strategy'nin aktif olduğunu **bilmez**. Sadece "execute et" der.

### 5. Controller bilmez

```typescript
class ChatController {
  async complete(req, res) {
    await this.service.complete({
      userId: req.user.id,
      chatId: req.body.chatId,
      message: req.body.message,
      response: res,
    });
  }
}
```

3 satır. Tüm karmaşıklık katmanlara dağıldı, **her biri kendi sorumluluğunu** üstlendi.

## `if/else` ile gerçek fark

| | if/else | Strategy |
|--|---------|----------|
| Kod konumu | Tek fonksiyon | Ayrı sınıflar |
| Yeni mod ekleme | Mevcut fonksiyonu aç, `else if` ekle | Yeni dosya, factory'ye 1 satır |
| Test | Hepsini aynı testte gez | Her strategy ayrı test |
| OCP | İhlal | Korunur |
| Mod sayısı 5+ olunca | Ahtapot | 5 küçük dosya |
| Mocking | Tüm fonksiyonu mock'la | Sadece kullanılan strategy |

## Tek dezavantaj — daha fazla dosya

İki seçenek için: 2 strategy + 1 interface + 1 factory = **4 dosya**. `if/else` ile 1 dosyada hallolurdu.

Bu maliyete katlanmanın gerekçesi: **gerçek projelerde mod sayısı 5-10'a çıkar**. `if/else` ahtapotuna dönüşür. Strategy bu gelecek yatırımıdır.

**Ne zaman katlanma?**
- Sadece 2 koşul, kesin başka eklenmeyecek → if/else OK
- 3+ koşul, ileride ekleme ihtimali var → Strategy

## Strategy pattern için domain örnekleri

| Domain | Strategy'ler |
|--------|-------------|
| Payment | Stripe, PayPal, Crypto, BankTransfer |
| Notification | Email, SMS, Push, Slack |
| Auth | JWT, OAuth, ApiKey, SAML |
| Compression | Gzip, Brotli, Zstd |
| Pagination | Cursor, Offset, KeySet |
| Cache eviction | LRU, LFU, FIFO, TTL |
| AI provider | OpenAI, Anthropic, Local |
| Rate limit | TokenBucket, LeakyBucket, FixedWindow |
| Discount | Percentage, FlatAmount, BuyXGetY |
| Storage | S3, GCS, LocalDisk |

Hepsi: 1 interface + N implementation + 1 factory.

## Frontend'de Strategy

```typescript
// hooks/useDataStrategy.ts
interface IFetchStrategy {
  fetch(): Promise<Data[]>;
}

class HttpFetchStrategy implements IFetchStrategy {
  async fetch() { return fetch("/api/data").then(r => r.json()); }
}

class WebSocketFetchStrategy implements IFetchStrategy {
  async fetch() { /* socket subscribe */ }
}

class MockFetchStrategy implements IFetchStrategy {
  async fetch() { return MOCK_DATA; }
}

export function useDataStrategy() {
  if (process.env.NEXT_PUBLIC_USE_MOCK === "true") return new MockFetchStrategy();
  if (featureFlags.realtime) return new WebSocketFetchStrategy();
  return new HttpFetchStrategy();
}
```

Component sadece `useData()` çağırır, hangi strategy aktif olduğunu bilmez.

## Yapma

- 2 koşul için bile pattern uygulamak — overengineering
- Strategy interface'inde `void` dönüş yerine `Promise<Result>` — composition zor
- Factory içinde kompleks karar (5+ if) — ayrı `Resolver` sınıfı
- Strategy'leri her seferinde `new` etmek — DI ile inject (singleton OK)
- Strategy'nin her birinin farklı parametre alması — context object ile uniform et
- Strategy pattern ama factory'siz (controller'da `if (X) new A() else new B()`) — pattern eksik
