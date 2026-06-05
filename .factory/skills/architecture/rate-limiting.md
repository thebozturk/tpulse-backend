---
name: rate-limiting
keywords: "rate limit, throttle, token bucket, leaky bucket, 429, abuse"
description: "Rate limiting — token bucket, route-specific, multi-instance Redis"
---

# Rate Limiting

## Neden var?

- Bot saldırılarına karşı koruma
- API kötüye kullanımı engelleme
- DB/AI maliyetlerinin kontrolü
- Belirli kullanıcıların sistemi domine etmesini engelleme

## Token bucket algorithm

Her kullanıcı için bir "kova":
- Belirli kapasiteyle başlar (örn 60 token)
- Her istek 1 token tüketir
- Belirli aralıklarla yenilenir (örn dakikada 60)
- Kova boşsa 429

```typescript
// rate-limit.service.ts
interface Bucket {
  tokens: number;
  resetAt: number;       // ms timestamp
}

export class RateLimitService {
  private buckets = new Map<string, Bucket>();

  constructor(
    private capacity: number,      // 60
    private windowMs: number,       // 60_000 (1 dakika)
  ) {}

  tryConsume(key: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    let bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt < now) {
      bucket = { tokens: this.capacity, resetAt: now + this.windowMs };
      this.buckets.set(key, bucket);
    }

    if (bucket.tokens === 0) {
      return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
    }

    bucket.tokens -= 1;
    return { allowed: true, remaining: bucket.tokens, resetAt: bucket.resetAt };
  }

  // Memory cleanup (cron veya periodic)
  cleanup() {
    const now = Date.now();
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt < now) this.buckets.delete(key);
    }
  }
}
```

## In-memory vs Redis

### In-memory (Map)
**Pros**: Sıfır dependency, milisaniye latency.
**Cons**: Multi-instance'da paylaşılmaz (her instance kendi bucket'ı). App restart'ta sıfırlanır.

Tek instance veya gerçek koruma değil "hız sınırı" yetiyorsa OK.

### Redis (multi-instance)
```typescript
import { Redis } from "ioredis";

export class RedisRateLimitService {
  constructor(
    private redis: Redis,
    private capacity: number,
    private windowMs: number,
  ) {}

  async tryConsume(key: string) {
    const fullKey = `ratelimit:${key}`;
    const now = Date.now();
    const windowSec = Math.ceil(this.windowMs / 1000);

    // Atomic Lua script — INCR + EXPIRE tek round-trip
    const script = `
      local current = redis.call('INCR', KEYS[1])
      if current == 1 then
        redis.call('EXPIRE', KEYS[1], ARGV[1])
      end
      return current
    `;

    const count = await this.redis.eval(script, 1, fullKey, windowSec) as number;

    if (count > this.capacity) {
      const ttl = await this.redis.ttl(fullKey);
      return { allowed: false, remaining: 0, resetAt: now + ttl * 1000 };
    }

    return {
      allowed: true,
      remaining: this.capacity - count,
      resetAt: now + windowSec * 1000,
    };
  }
}
```

Multi-pod deployment'larda **zorunlu**. Tek pod ise in-memory yeter.

## Route-specific

```typescript
// middleware/rate-limit.middleware.ts
export function rateLimit(routeName: string) {
  return (req, res, next) => {
    const userId = req.user?.id ?? req.ip;
    const key = `${routeName}:${userId}`;

    const { allowed, remaining, resetAt } = rateLimitService.tryConsume(key);

    res.setHeader("X-RateLimit-Limit", capacity);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader("X-RateLimit-Reset", Math.floor(resetAt / 1000));

    if (!allowed) {
      throw new RateLimitError("Too many requests");
    }
    next();
  };
}
```

Bucket key: `<route>:<userId>` — her route kendi bucket'ı.

```typescript
router.get("/api/chats", rateLimit("list-chats"), ...);          // 60/dk
router.post("/api/completion", rateLimit("completion"), ...);    // 10/dk
```

**Liste ucuz, completion pahalı.** Aynı limit ikisine uygulanırsa: ya liste fazla kısıtlı ya completion az kısıtlı.

## Per-route config

```typescript
const RATE_LIMITS: Record<string, { capacity: number; windowMs: number }> = {
  "list-chats": { capacity: 60, windowMs: 60_000 },
  "history": { capacity: 30, windowMs: 60_000 },
  "completion": { capacity: 10, windowMs: 60_000 },
};

export function rateLimit(routeName: string) {
  const config = RATE_LIMITS[routeName];
  if (!config) throw new Error(`No rate limit config for ${routeName}`);
  // ...
}
```

## FF entegrasyonu

`RATE_LIMIT_PER_MINUTE` flag'i baz değer:

```typescript
const baseLimit = flags.get("RATE_LIMIT_PER_MINUTE");

const RATE_LIMITS = {
  "list-chats": { capacity: baseLimit, windowMs: 60_000 },
  "completion": { capacity: Math.ceil(baseLimit / 6), windowMs: 60_000 },  // 1/6 oran
};
```

Production'da yoğun saatte FF ile limit artırılır, sorun anında düşürülür — restart yok.

## Auth sırası — kritik

Rate limit **auth'tan SONRA**.

```
✓ app-check → auth → rate-limit (per-user bucket)
✗ rate-limit (per-IP) → app-check → auth
```

Auth'tan önce rate limit yapılırsa:
- Anonymous istekler de bucket tüketir
- IP-based bucket NAT'tan ortak çıkan kullanıcıları cezalandırır
- Geçersiz token'lı isteklerin de bucket'ı dolar

Auth'tan sonra: bucket key = `<route>:<real-user-id>`. Adil ve doğru.

**İstisna**: Login endpoint için pre-auth rate limit (brute force koruması) ayrı middleware:
```typescript
router.post("/api/auth/login", rateLimitByIp("login", 5, 60_000), ...);
```

## Header bilgisi — frontend uyumluluğu

```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 23
X-RateLimit-Reset: 1730800000
```

429 dönerken:
```http
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1730800060
Retry-After: 45
```

`Retry-After` saniye cinsinden, frontend exponential backoff için kullanır.

## Test

```typescript
describe("RateLimitService", () => {
  it("allows up to capacity", () => {
    const svc = new RateLimitService(3, 60_000);
    expect(svc.tryConsume("user1").allowed).toBe(true);
    expect(svc.tryConsume("user1").allowed).toBe(true);
    expect(svc.tryConsume("user1").allowed).toBe(true);
    expect(svc.tryConsume("user1").allowed).toBe(false);   // capacity dolu
  });

  it("isolates buckets by key", () => {
    const svc = new RateLimitService(1, 60_000);
    svc.tryConsume("user1");
    expect(svc.tryConsume("user2").allowed).toBe(true);    // farklı bucket
  });

  it("resets after window", async () => {
    const svc = new RateLimitService(1, 100);
    svc.tryConsume("user1");
    expect(svc.tryConsume("user1").allowed).toBe(false);

    await new Promise(r => setTimeout(r, 150));
    expect(svc.tryConsume("user1").allowed).toBe(true);   // reset oldu
  });
});
```

## Yapma

- Auth ÖNCE rate limit (anonymous bucket sızıntısı)
- Global rate limit (tüm route'lar tek bucket)
- IP-based rate limit auth'lu API'de (NAT cezası)
- Multi-pod'da in-memory (her pod'un kendi bucket'ı = effective limit Nx olur)
- Bucket cleanup atlamak (memory leak)
- 429'da `Retry-After` header'ı eksik (client backoff hesaplayamaz)
- `RATE_LIMIT_PER_MINUTE` FF'ini cache'lemek (hot reload'u öldürür)

## Aksiyon

1. Token bucket algorithm — capacity + windowMs
2. In-memory Map tek instance, Redis multi-instance
3. Bucket key: `<route>:<userId>`
4. Auth middleware'den SONRA
5. `X-RateLimit-*` header her response'a
6. 429'da `Retry-After`
7. FF baz değerini her seferinde oku
8. Login için pre-auth IP-based ayrı middleware
9. Memory cleanup periodic (cron veya `setInterval`)
