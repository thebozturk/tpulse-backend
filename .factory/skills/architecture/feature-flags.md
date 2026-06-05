---
name: feature-flags
keywords: "feature flag, FF, toggle, runtime, configuration, hot reload"
description: "Feature Flag servisi — type-safe, hot reload, override"
---

# Feature Flagging

**Runtime'da konfigürasyon değişerek davranışın değişebildiği** bir sistem. Code sabit, davranış FF'e göre dinamik.

## Dört yetenek (iş değeri)

1. **A/B testleri** — yeni özelliği önce kullanıcıların %10'una aç
2. **Maliyet kontrolü** — pahalı streaming sadece premium kullanıcılara
3. **Risk yönetimi** — sorunlu özellik anında kapatılır
4. **Kademeli rollout** — önce iç ekipler, sonra beta, sonra herkes

## FF type definition

```typescript
// types/feature-flags.ts
export interface FeatureFlags {
  STREAMING_ENABLED: boolean;
  PAGINATION_LIMIT: number;
  AI_TOOLS_ENABLED: boolean;
  CHAT_HISTORY_ENABLED: boolean;
  RATE_LIMIT_PER_MINUTE: number;
  MAX_TOKENS_PER_REQUEST: number;
}
```

## FF service — type-safe

```typescript
// feature-flag.service.ts
import { z } from "zod";

const flagSchema = z.object({
  STREAMING_ENABLED: z.coerce.boolean().default(false),
  PAGINATION_LIMIT: z.coerce.number().int().min(10).max(100).default(20),
  AI_TOOLS_ENABLED: z.coerce.boolean().default(false),
  CHAT_HISTORY_ENABLED: z.coerce.boolean().default(true),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).max(1000).default(60),
  MAX_TOKENS_PER_REQUEST: z.coerce.number().int().min(100).max(8000).default(2000),
});

export type FeatureFlags = z.infer<typeof flagSchema>;

export interface IFeatureFlagService {
  get<K extends keyof FeatureFlags>(key: K): FeatureFlags[K];
  isEnabled(key: keyof FeatureFlags): boolean;
  reload(): void;
  override<K extends keyof FeatureFlags>(key: K, value: FeatureFlags[K]): void;
  reset(): void;
}

export class FeatureFlagService implements IFeatureFlagService {
  private static instance: FeatureFlagService;
  private flags: FeatureFlags;
  private overrides: Partial<FeatureFlags> = {};

  private constructor() {
    this.flags = this.loadFromEnv();
  }

  static getInstance(): FeatureFlagService {
    if (!this.instance) {
      this.instance = new FeatureFlagService();
    }
    return this.instance;
  }

  private loadFromEnv(): FeatureFlags {
    return flagSchema.parse({
      STREAMING_ENABLED: process.env.STREAMING_ENABLED,
      PAGINATION_LIMIT: process.env.PAGINATION_LIMIT,
      AI_TOOLS_ENABLED: process.env.AI_TOOLS_ENABLED,
      CHAT_HISTORY_ENABLED: process.env.CHAT_HISTORY_ENABLED,
      RATE_LIMIT_PER_MINUTE: process.env.RATE_LIMIT_PER_MINUTE,
      MAX_TOKENS_PER_REQUEST: process.env.MAX_TOKENS_PER_REQUEST,
    });
  }

  get<K extends keyof FeatureFlags>(key: K): FeatureFlags[K] {
    if (key in this.overrides) return this.overrides[key]!;
    return this.flags[key];
  }

  isEnabled(key: keyof FeatureFlags): boolean {
    const value = this.get(key);
    return Boolean(value);
  }

  reload(): void {
    this.flags = this.loadFromEnv();
  }

  override<K extends keyof FeatureFlags>(key: K, value: FeatureFlags[K]): void {
    this.overrides[key] = value;
  }

  reset(): void {
    this.overrides = {};
  }
}
```

## Type safety — neden önemli

```typescript
const limit = flags.get("PAGINATION_LIMIT");      // number
const enabled = flags.get("STREAMING_ENABLED");    // boolean

flags.get("UNKNOWN_KEY");  // ← compile-time hata: 'UNKNOWN_KEY' is not assignable
```

Generic `get<K extends keyof FeatureFlags>(key: K): FeatureFlags[K]` — yanlış key veya yanlış tip kullanım compile-time'da yakalanır.

## Hot reload — admin endpoint

```typescript
// admin.controller.ts
@Controller("api/admin")
@UseGuards(AdminGuard)              // sadece admin
export class AdminController {
  constructor(private flags: IFeatureFlagService) {}

  @Post("flags/reload")
  reload() {
    this.flags.reload();
    return { success: true, message: "Feature flags reloaded" };
  }

  @Get("flags")
  list() {
    return {
      success: true,
      data: {
        STREAMING_ENABLED: this.flags.get("STREAMING_ENABLED"),
        PAGINATION_LIMIT: this.flags.get("PAGINATION_LIMIT"),
        // ...
      },
    };
  }
}
```

Workflow:
1. `.env` dosyasını değiştir
2. `POST /api/admin/flags/reload` çağır
3. Yeni değerler **anında aktif** — restart yok

## Hot reload — file watcher (alternatif)

```typescript
import chokidar from "chokidar";
import * as dotenv from "dotenv";

chokidar.watch(".env").on("change", () => {
  dotenv.config({ override: true });
  flags.reload();
  logger.info("Feature flags auto-reloaded from .env");
});
```

Pros: tam otomatik. Cons: extra dependency, dosya değişimleri "büyülü" — debug zor. Admin endpoint daha tahmin edilebilir.

## Default değerler ve fallback

Her flag'in default'u var. Env'de tanımlı değilse veya parse edilemezse default kullanılır → sistem **kırılgan değil**.

```typescript
PAGINATION_LIMIT: z.coerce.number().int().min(10).max(100).default(20),
//                                                          ^^^^^^^^^
//                                                  env yoksa veya parse fail → 20
```

## FF kullanımı service'te

```typescript
class ChatService {
  constructor(
    private repo: IChatRepository,
    private flags: IFeatureFlagService,    // ← interface
  ) {}

  async listChats(userId: string, cursor?: string) {
    const limit = this.flags.get("PAGINATION_LIMIT");   // type: number
    return this.repo.findByUserId(userId, { limit, cursor });
  }
}
```

Service flag'i okur, **parametre olarak** repo'ya geçirir. Repo flag varlığını bilmez.

## FF + Strategy kombinasyonu

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

Davranış değişimi **tek satırda**. Yeni mod = yeni strategy + factory'de 1 satır.

## Test — override mekanizması

```typescript
describe("ChatService", () => {
  let service: ChatService;
  let flags: IFeatureFlagService;
  let repo: IChatRepository;

  beforeEach(() => {
    flags = FeatureFlagService.getInstance();
    flags.reset();   // ← önceki test'in override'larını temizle
    repo = { findByUserId: jest.fn().mockResolvedValue([]) };
    service = new ChatService(repo, flags);
  });

  afterEach(() => {
    flags.reset();
  });

  it("uses default pagination limit", async () => {
    await service.listChats("u1");
    expect(repo.findByUserId).toHaveBeenCalledWith("u1", expect.objectContaining({ limit: 20 }));
  });

  it("uses overridden limit", async () => {
    flags.override("PAGINATION_LIMIT", 50);
    await service.listChats("u1");
    expect(repo.findByUserId).toHaveBeenCalledWith("u1", expect.objectContaining({ limit: 50 }));
  });
});
```

**`reset()` test isolation için kritik.** Yoksa test'ler birbirine sızar.

## .env örneği

```bash
# .env
STREAMING_ENABLED=true
PAGINATION_LIMIT=20
AI_TOOLS_ENABLED=false
CHAT_HISTORY_ENABLED=true
RATE_LIMIT_PER_MINUTE=60
MAX_TOKENS_PER_REQUEST=2000
```

`.env.example` aynı liste, gerçek değer yerine placeholder.

## Yapma

- `flags[key]` direkt erişim (type-safety kayıp) — `flags.get(key)` kullan
- FF değerini cache field'da tutmak (`this.cachedLimit = flags.get(...)`) — hot reload bozulur, her seferinde `get()` çağır
- Service'de `process.env.X` direkt okumak — FF service üzerinden geç
- FF olmadan controller'da `if` — Strategy + Factory kullan
- Test'te `reset()` çağırmamak — bir sonraki test override'ı görür
- FF'i database'den okumak (her get'te DB hit) — env'den oku, hot reload ile yenile
- Boolean olmayan flag'i `if (flag)` ile kullanmak (`PAGINATION_LIMIT`'i `if (limit)` ile değil `flags.get("PAGINATION_LIMIT")` ile oku)
- Production'da admin endpoint'i auth'suz açmak — guard ZORUNLU

## Aksiyon

1. `IFeatureFlagService` interface yaz (type-safe `get<K>`)
2. `FeatureFlagService` Singleton + zod parse
3. Default value her flag için
4. Service'lere DI ile inject (`constructor(flags: IFeatureFlagService)`)
5. Strategy + Factory ile kullan, controller'da `if` yapma
6. Admin reload endpoint (`POST /admin/flags/reload`)
7. Test'te `reset()` afterEach'te
8. `.env.example`'da tüm flag'leri listele
