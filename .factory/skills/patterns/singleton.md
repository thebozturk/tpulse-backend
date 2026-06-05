---
name: singleton
keywords: "singleton, instance, global, shared, infrastructure"
description: "Singleton pattern — ne zaman doğru, ne zaman tehlikeli"
---

# Singleton Pattern

**Uygulama yaşam süresi boyunca tek bir instance olması gereken kaynaklar için.**

## Doğru kullanım — infrastructure

### 1. Database client (Prisma, Mongoose connection)

```typescript
// prisma.singleton.ts
import { PrismaClient } from "@prisma/client";

let _prisma: PrismaClient | undefined;

export function getPrisma(): PrismaClient {
  if (!_prisma) {
    _prisma = new PrismaClient({
      log: ["query", "error", "warn"],
    });
  }
  return _prisma;
}
```

**Neden tek instance?** Prisma kendi connection pool'unu tutar. Birden fazla instance = her biri kendi pool'unu açar = DB connection limiti dolar.

NestJS'de `@Injectable()` + `providedIn: "root"` Singleton garantisidir.

### 2. Logger

```typescript
import pino from "pino";

let _logger: pino.Logger | undefined;

export function getLogger(): pino.Logger {
  if (!_logger) {
    _logger = pino({
      level: process.env.LOG_LEVEL || "info",
      transport: process.env.NODE_ENV === "development"
        ? { target: "pino-pretty" }
        : undefined,
    });
  }
  return _logger;
}
```

**Neden tek?** Sistem aynı log konfigürasyonunu (level, format, transport) paylaşmalı. Birden fazla logger = log seviyelerinin senkronsuz olması, log'ların farklı yerlere düşmesi.

### 3. Config

```typescript
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(16),
});

let _env: z.infer<typeof envSchema> | undefined;

export function getEnv() {
  if (!_env) {
    _env = envSchema.parse(process.env);
  }
  return _env;
}
```

**Neden tek?** Konfigürasyon, uygulama açılışında bir kere okunur, parse edilir, valide edilir. Tüm sistemin **aynı config'i görmesi** kritik.

### 4. Feature Flag service

```typescript
class FeatureFlagService {
  private static instance: FeatureFlagService;
  private flags: FeatureFlags;

  private constructor() {
    this.flags = this.loadFromEnv();
  }

  static getInstance(): FeatureFlagService {
    if (!this.instance) {
      this.instance = new FeatureFlagService();
    }
    return this.instance;
  }

  get<K extends keyof FeatureFlags>(key: K): FeatureFlags[K] {
    return this.flags[key];
  }

  reload() {
    this.flags = this.loadFromEnv();
  }
}
```

**Neden tek?** Aynı anda farklı modüllerin farklı flag değerleri görmemesi gerek. Reload edildiğinde, herkes aynı anda yeni değerleri görür.

## Yanlış kullanım — business logic

### Service Singleton ❌

```typescript
class UserService {
  private static instance: UserService;
  private repo = new UserRepository();    // ← yarattı

  static getInstance() { /* ... */ }
}
```

**Sorun 1: Test edilemez.** `instance` static — mock vermek için reflection veya monkey-patch gerek. Pratikte: testte gerçek DB'ye gidersin.

**Sorun 2: Bağımlılık gizli.** Constructor parametresi yok — service'in neye ihtiyacı olduğunu okumak için içine bakmak gerek.

**Sorun 3: Rastgele state paylaşımı.** Service'in cache field'ı varsa, tüm istekler aynı cache'i paylaşır — race condition kaynağı.

### Doğru — DI ile yarat, container yönet

```typescript
class UserService {
  constructor(
    private repo: IUserRepository,        // ← interface, DI ile gelir
    private logger: ILogger,
  ) {}
}

// DI Container — tek instance ama explicit
const repo = new PrismaUserRepository(prisma);
const userService = new UserService(repo, logger);
```

Container istediği gibi yönetir: tek instance da olabilir, request başına yeni instance da. Önemli olan **service'in kendi içinde** singleton mantığı olmaması.

## Singleton'ın gizli tehlikesi: Global state

```typescript
// Test 1
const ff = FeatureFlagService.getInstance();
ff.override("STREAMING_ENABLED", true);
testStreamingEndpoint();

// Test 2 — başka test dosyası
const ff = FeatureFlagService.getInstance();   // ← AYNI instance
ff.get("STREAMING_ENABLED");                    // → true (Test 1'den sızdı)
```

Test'ler birbirine sızar. Çözüm:

```typescript
afterEach(() => {
  FeatureFlagService.getInstance().reset();
});
```

Veya daha iyi:

```typescript
class UserService {
  constructor(private flags: IFeatureFlagService) {}    // ← DI ile mock'lanabilir
}
```

Her test için yeni mock = sızıntı yok.

## Pragmatik çözüm — interface üzerinden

```typescript
interface IFeatureFlagService {
  get<K extends keyof FeatureFlags>(key: K): FeatureFlags[K];
  isEnabled(key: keyof FeatureFlags): boolean;
}

// Production: real singleton
const flags: IFeatureFlagService = FeatureFlagService.getInstance();

// Test: mock
const flags: IFeatureFlagService = {
  get: jest.fn().mockReturnValue(true),
  isEnabled: jest.fn().mockReturnValue(true),
};

const service = new UserService(flags);
```

Service `IFeatureFlagService` alır — production'da Singleton, test'te mock. İkisi de uyar.

## NestJS özel notu

NestJS'de `@Injectable()` provider'lar default Singleton (`Scope.DEFAULT`). Yani:

```typescript
@Injectable()
export class UserService {
  // Default singleton
}
```

Test'te `Test.createTestingModule({...}).overrideProvider(UserService).useValue(mock)` ile değiştirilir. Sıkıntı yok.

`Scope.REQUEST`, `Scope.TRANSIENT` ile request-bazlı veya yeni instance da yapılabilir, ama nadir.

## Karar matrisi

| Tip | Singleton? | Neden? |
|-----|-----------|--------|
| Database client | ✅ | Connection pool tek olmalı |
| Logger | ✅ | Konfigürasyon paylaşımı |
| Config / Env | ✅ | Tek doğru kaynak |
| Feature Flag | ✅ | Senkronize değer paylaşımı |
| Cache layer | ✅ | Tek hafıza alanı |
| Email queue | ✅ | Tek kuyruk |
| Service (`UserService`, `OrderService`) | ❌ | Test'te mock zor, DI tercih |
| Repository (`UserRepository`) | ❌ | Aynı sebep |
| Strategy | ❌ | Factory yaratır, kullan, at |
| Controller | ❌ | NestJS scope yönetir |
| DTO/Schema | ❌ | Stateless, neden tek olsun |

## Yapma

- Service / Repository Singleton — test mock'lamayı öldürür
- `getInstance()`'ı her sınıfa eklemek — 5 dosya sonra DI container'ı reinvent edersin
- Singleton'ı modül-level'da `export const x = new X()` ile saklamak — test'te require cache'i temizlemen gerek, ağrı
- State'i Singleton'da tutmak (counter, cache, queue) — race condition + test sızıntısı + reset zorluğu
- Singleton + new field her seferinde — "tek instance" sözüne ihanet
