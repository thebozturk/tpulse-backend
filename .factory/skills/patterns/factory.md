---
name: factory
keywords: "factory, creational, instance, build, create"
description: "Factory pattern — Strategy seçici, doğru nesneyi döndürme"
---

# Factory Pattern

"Şu an, doğru nesne nedir?" sorusuna cevap veren bileşen.

## Factory'nin tek görevi

Nesne yaratmak ve **hangi nesnenin yaratılacağı kararını içermek**.

## Strategy ile bağlantı

Strategy implementations bilgisiz nesnelerdir; ne zaman çalışacaklarını bilmezler. Factory **seçim mantığını** kapsüller.

```typescript
class CompletionStrategyFactory {
  constructor(
    private flags: IFeatureFlagService,
    private streaming: StreamingCompletionStrategy,
    private json: JsonCompletionStrategy,
  ) {}

  create(): ICompletionStrategy {
    return this.flags.isEnabled("STREAMING_ENABLED") ? this.streaming : this.json;
  }
}
```

Tek satır karar. Factory'nin tek sorumluluğu.

## Factory ne zaman çalışır?

Her istekte **yeni Factory** yaratılmaz; Factory de DI container'da tek nesne olarak yaşar (Singleton-like).

Ama `create()` metodu **her çağrıldığında**, o anki feature flag durumuna göre karar verir. Bu **hot reload** ile uyumludur:

```typescript
// t=0
factory.create() → StreamingStrategy   (flag açık)

// FF reload (1 saniye sonra)
flags.reload();
flags.set("STREAMING_ENABLED", false);

// t=1.5
factory.create() → JsonStrategy        (flag kapalı, hiç restart yok)
```

## Factory'nin testlenmesi

Factory test etmek kolay:

```typescript
describe("CompletionStrategyFactory", () => {
  it("returns StreamingStrategy when flag enabled", () => {
    const flags: IFeatureFlagService = {
      isEnabled: jest.fn().mockReturnValue(true),
      get: jest.fn(),
    };
    const streaming = new StreamingCompletionStrategy(/* ... */);
    const json = new JsonCompletionStrategy(/* ... */);
    const factory = new CompletionStrategyFactory(flags, streaming, json);

    expect(factory.create()).toBe(streaming);
  });

  it("returns JsonStrategy when flag disabled", () => {
    const flags: IFeatureFlagService = {
      isEnabled: jest.fn().mockReturnValue(false),
      get: jest.fn(),
    };
    /* ... */
    expect(factory.create()).toBe(json);
  });
});
```

İki test = "flag açıkken Streaming, kapalıyken Json" garantisi.

## Factory varyasyonları

### 1. Simple Factory (en yaygın)

```typescript
class CompletionStrategyFactory {
  create(): ICompletionStrategy { /* ... */ }
}
```

Tek karar noktası, tek `create()` method. **Bu projede default seçim.**

### 2. Factory Method (Template + Factory)

```typescript
abstract class BaseHandler {
  abstract createStrategy(): ICompletionStrategy;

  async handle(input: Input) {
    const strategy = this.createStrategy();
    return strategy.execute(input);
  }
}

class StreamingHandler extends BaseHandler {
  createStrategy() { return new StreamingStrategy(); }
}

class JsonHandler extends BaseHandler {
  createStrategy() { return new JsonStrategy(); }
}
```

Inheritance gerektirir. JS/TS'de nadir kullanılır — composition tercih.

### 3. Abstract Factory (family of related)

```typescript
interface IUIComponentFactory {
  createButton(): IButton;
  createInput(): IInput;
  createModal(): IModal;
}

class WebFactory implements IUIComponentFactory { /* ... */ }
class MobileFactory implements IUIComponentFactory { /* ... */ }
```

Birden fazla **ilişkili** nesne için. Frontend cross-platform UI'da kullanılır, backend'de nadir.

### 4. Builder (kompleks construction)

```typescript
const query = new QueryBuilder()
  .from("users")
  .where("active", true)
  .orderBy("createdAt", "desc")
  .limit(20)
  .build();
```

Kompleks parametreli construction için. Factory değil — ama complement.

## Factory + Registry pattern

Çok strategy varsa registry kullan:

```typescript
class StrategyRegistry {
  private strategies = new Map<string, ICompletionStrategy>();

  register(key: string, strategy: ICompletionStrategy) {
    this.strategies.set(key, strategy);
  }

  get(key: string): ICompletionStrategy {
    const s = this.strategies.get(key);
    if (!s) throw new Error(`Unknown strategy: ${key}`);
    return s;
  }
}

// Boot
registry.register("streaming", new StreamingStrategy());
registry.register("json", new JsonStrategy());
registry.register("tool-enabled", new ToolEnabledStrategy());

// Factory uses registry
class CompletionFactory {
  constructor(
    private flags: IFeatureFlagService,
    private registry: StrategyRegistry,
  ) {}

  create(): ICompletionStrategy {
    if (this.flags.isEnabled("AI_TOOLS_ENABLED")) return this.registry.get("tool-enabled");
    if (this.flags.isEnabled("STREAMING_ENABLED")) return this.registry.get("streaming");
    return this.registry.get("json");
  }
}
```

Yeni strategy = `registry.register(...)` 1 satır + factory'de 1 satır karar.

## Factory'nin DI ile entegrasyonu

```typescript
// di-container.ts
const flags = FeatureFlagService.getInstance();
const ai = new AIService();

const streaming = new StreamingCompletionStrategy(ai);
const json = new JsonCompletionStrategy(ai);

const completionFactory = new CompletionStrategyFactory(flags, streaming, json);

const chatService = new ChatService(chatRepo, msgRepo, completionFactory);
```

Strategy'ler **bir kere yaratılır**. Factory bunları tutar, `create()` çağrıldığında doğru olanı döner.

## Factory ne zaman GEREK YOK?

```typescript
// Sadece 2 mod, başka eklenmeyecek, runtime karar gerekmiyor
function getBackend(useMock: boolean): Backend {
  return useMock ? new MockBackend() : new RealBackend();
}
```

Tek satır. Class oluşturmak overengineering.

**Factory dene** sadece:
- 3+ implementation
- Runtime'da seçilecek
- Test'te kolayca mock edilebilmesi gerek
- Feature flag'e bağlı seçim

## Yapma

- Factory'nin içinde **business logic** çalıştırmak — sadece nesne döndür
- Factory'de yan etki (DB call, API call, log) — pure return
- Her küçük şey için Factory — `if (mock) Mock else Real` 1 satır yeter
- Factory'yi her create'te yeni instance yapmak (`new Factory().create()`) — DI ile singleton
- Factory + Singleton karıştırmak — Factory'i Singleton yapma, DI yönetir
- Factory dönen interface yerine concrete tip — `create(): IStrategy` (interface), not `create(): ConcreteStrategy`
- Factory'de exception swallowing (`try-catch return null`) — failure explicit
