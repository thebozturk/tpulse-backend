---
name: security-rate-limit
keywords: "rate limit, throttle, @nestjs/throttler, ddos, brute force"
description: "Rate limiting — multi-tier, IP+user-based, adaptive"
---

# Rate Limiting

## @nestjs/throttler

```bash
pnpm add @nestjs/throttler
```

### Setup

```typescript
// app.module.ts
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,      // 1 saniye
        limit: 10,       // 10 req
      },
      {
        name: 'medium',
        ttl: 60_000,     // 1 dakika
        limit: 100,
      },
      {
        name: 'long',
        ttl: 3600_000,   // 1 saat
        limit: 5000,
      },
    ]),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
```

**Multi-tier:** kısa burst'u engelle + uzun abuse'u da engelle.

## Endpoint-specific throttle

```typescript
@Post('login')
@Throttle({ default: { limit: 5, ttl: 60_000 } })  // 5/dk
async login(@Body() dto: LoginDto) { ... }

@Post('reset-password')
@Throttle({ default: { limit: 3, ttl: 300_000 } })  // 3/5dk
async requestReset() { ... }
```

## Skip

```typescript
@Get('health')
@SkipThrottle()
async health() { ... }
```

## Custom storage (Redis)

Multi-instance için memory store yetmez:

```bash
pnpm add @nest-lab/throttler-storage-redis ioredis
```

```typescript
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';

ThrottlerModule.forRootAsync({
  useFactory: (redis: Redis) => ({
    throttlers: [...],
    storage: new ThrottlerStorageRedisService(redis),
  }),
  inject: [REDIS_CLIENT],
}),
```

Kritik multi-pod deployment'ta. Memory store sadece 1 pod için doğru.

## User-based limit

Default IP-based. User'a göre:

```typescript
@Injectable()
export class UserBasedThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    return req.user?.id ?? req.ip;  // login'liyse userId, değilse IP
  }
}
```

Kullan: IP değişkenliği yüksek (mobile, carrier NAT).

## Combine: IP + user-based

```typescript
export class CombinedThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    if (req.user) return `user:${req.user.id}`;
    return `ip:${req.ip}`;
  }
}
```

Authenticated user kendi limit'ine sahip, anonymous IP-based.

## Tier sistemi

```typescript
// Role-based dynamic limit
@Injectable()
export class TieredThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: any): Promise<string> {
    return req.user?.id ?? req.ip;
  }

  protected getLimit(req: any): number {
    const tier = req.user?.tier;  // 'free' | 'pro' | 'enterprise'
    return { free: 100, pro: 1000, enterprise: 10000 }[tier] || 100;
  }
}
```

Paid user daha çok request.

## Adaptive (suspicion-based)

Bot-defense ile birlikte. Suspicion yüksekse limit sert:

```typescript
async getLimit(req) {
  const suspicion = await this.botDefense.getSuspicion(req);
  if (suspicion > 0.8) return 1;   // 1 req/dk — brute-force yavaşlat
  if (suspicion > 0.5) return 10;
  return 100;
}
```

## Kritik endpoint'ler için sıkı throttle

```typescript
// Login — brute force
@Post('login')
@Throttle({ default: { limit: 5, ttl: 60_000 } })
async login() { ... }

// Password reset — email flood
@Post('reset-request')
@Throttle({ default: { limit: 3, ttl: 300_000 } })
async requestReset() { ... }

// Register — spam account
@Post('register')
@Throttle({ default: { limit: 5, ttl: 3600_000 } })
async register() { ... }

// OTP verify — brute force OTP
@Post('verify-otp')
@Throttle({ default: { limit: 5, ttl: 60_000 } })
async verifyOtp() { ... }
```

## Response

429 dönüldüğünde:
```
HTTP/1.1 429 Too Many Requests
Retry-After: 30
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1713712345
```

Frontend user'a gösterir: "Try again in 30 seconds".

## DDoS (uygulama-katmanı)

Throttler uygulama-katmanı. Network-katmanı DDoS için:
- Cloudflare / AWS Shield (L3/L4)
- Reverse proxy: nginx rate limit + fail2ban

Uygulama katmanı sadece uygulama-özel saldırılara (brute force, scraping, API abuse).

## Proxy / CDN arkasında IP

`req.ip` gerçek user IP'si değil, proxy IP'si. Trust proxy:

```typescript
// main.ts
app.set('trust proxy', 1);  // 1 proxy var — Cloudflare
```

Sonra `X-Forwarded-For` doğru parse edilir.

**Dikkat:** `trust proxy: true` + header spoofing. Sadece trust edilen proxy'ye.

## Anti-pattern'ler

### No throttle
```typescript
@Post('login')
async login() { ... }  // ❌ 10k req/sec, password brute force
```

### Memory store multi-pod
```typescript
ThrottlerModule.forRoot([...])  // ❌ her pod kendi sayacı — limit 3x artar
```
Redis storage.

### IP ile limit authenticated user'a
```typescript
// ❌ Ofiste 50 kişi — ortak IP, herkesin limit'i tek IP'de tükenir
// User-based veya hybrid tracker.
```

### Tüm endpoint'ler aynı limit
```typescript
// ❌ /health 5/dk ise health check fail
// ✓ @SkipThrottle() health'te
```

### Response'ta Retry-After yok
Frontend ne yapacağını bilmez.

## Aksiyon

1. Global multi-tier throttler (1s, 1dk, 1sa)
2. Critical endpoint'lerde sıkı @Throttle
3. Redis storage multi-pod
4. IP + user-based hybrid tracker
5. /health ve metrics'e @SkipThrottle
6. trust proxy 1 (CDN arkasındaysa)
7. 429'da Retry-After header
