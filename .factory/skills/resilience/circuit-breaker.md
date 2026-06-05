---
name: resilience-circuit-breaker
keywords: "circuit breaker, opossum, retry, fallback, downstream"
description: "Circuit breaker — external service failure isolation"
---

# Circuit Breaker

## Problem

External service (Stripe, SendGrid, Redis) yavaş veya down → backend her request'te 30s timeout → tüm thread'ler doluyor → backend de down.

Cascading failure.

## Çözüm: Circuit Breaker pattern

3 state:
- **Closed:** Normal işliyor, çağrılar geçer
- **Open:** Threshold aşıldı, çağrılar HEMEN fail (downstream'e dokunma)
- **Half-Open:** Test çağrısı, başarılıysa Closed, fail ise Open

```
Closed → (N fail in window) → Open → (timeout) → Half-Open → (success) → Closed
                                                          ↘ (fail) → Open
```

## opossum

```bash
pnpm add opossum
pnpm add -D @types/opossum
```

```typescript
import * as CircuitBreaker from 'opossum';

@Injectable()
export class StripeService {
  private breaker: CircuitBreaker;

  constructor(private readonly stripe: Stripe) {
    this.breaker = new CircuitBreaker(
      async (params: ChargeParams) => this.stripe.charges.create(params),
      {
        timeout: 5000,                  // 5s response gelmezse fail
        errorThresholdPercentage: 50,   // 50% fail rate → open
        resetTimeout: 30000,             // 30s sonra half-open
        rollingCountTimeout: 10000,      // 10s sliding window
        rollingCountBuckets: 10,
        volumeThreshold: 5,              // En az 5 request/window — yoksa open etme
      },
    );

    // Fallback (opsiyonel)
    this.breaker.fallback(() => {
      throw new ServiceUnavailableException('Payment service unavailable');
    });

    // Logging
    this.breaker.on('open', () => this.logger.error('Circuit OPEN — Stripe down'));
    this.breaker.on('halfOpen', () => this.logger.log('Circuit HALF-OPEN'));
    this.breaker.on('close', () => this.logger.log('Circuit CLOSED'));
  }

  async charge(params: ChargeParams): Promise<any> {
    return this.breaker.fire(params);
  }
}
```

## Çoklu external service

Her external service için ayrı breaker:
```typescript
@Injectable()
export class CircuitBreakerFactory {
  create<T>(fn: (...args: any[]) => Promise<T>, options?: CircuitBreaker.Options): CircuitBreaker {
    return new CircuitBreaker(fn, {
      timeout: 5000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000,
      ...options,
    });
  }
}
```

Stripe down olsa bile SendGrid çağrıları etkilenmez — bağımsız.

## Fallback strategy

### 1. Throw error (default)
```typescript
breaker.fallback(() => {
  throw new ServiceUnavailableException();
});
```

### 2. Cached response
```typescript
breaker.fallback(async () => {
  const cached = await this.cache.get('last-good-rates');
  return cached || defaultRates;
});
```

### 3. Degraded mode
```typescript
breaker.fallback(() => {
  // Email gönderilemiyor, queue'la sonra
  this.emailQueue.add(emailData);
  return { queued: true };
});
```

## Health check entegrasyonu

Breaker open ise health check 503:
```typescript
@Injectable()
export class HealthIndicator {
  isHealthy(): boolean {
    return !this.stripeBreaker.opened &&
           !this.redisBreaker.opened;
  }
}
```

Load balancer pod'u traffic'tan alır.

## Bulkhead ile combine

Her external'e ayrı thread/connection pool:
```typescript
// Stripe için max 10 concurrent
const stripeSemaphore = new Semaphore(10);

async charge() {
  return stripeSemaphore.acquire(() =>
    this.breaker.fire(...)
  );
}
```

Stripe yavaşladığında başka external service'lerin pool'ları hala vacant.

## Monitoring

Prometheus metric:
```typescript
breaker.on('fire', () => this.metrics.increment('circuit.fire'));
breaker.on('reject', () => this.metrics.increment('circuit.reject'));  // open while
breaker.on('timeout', () => this.metrics.increment('circuit.timeout'));
breaker.on('failure', () => this.metrics.increment('circuit.failure'));
breaker.on('success', () => this.metrics.increment('circuit.success'));
breaker.on('open', () => this.metrics.increment('circuit.open_event'));
```

Grafana panel: open count, reject rate.

## Tuning

### errorThresholdPercentage

- 50% — moderate (default)
- 25% — sensitive (kritik servis için)
- 75% — tolerant (best-effort servis)

### resetTimeout

- 10s — hızlı recovery deneme
- 30s — default
- 60s — pahalı service (downstream cooldown lazım)

### timeout

External service'in normal latency'sinden fazla:
- DB: 1s
- HTTP API: 5s
- Email/SMS: 10s

## Hangi çağrılarda

**Evet:**
- 3rd-party API (Stripe, SendGrid, Twilio, OAuth)
- Microservice-to-microservice
- Slow upstream (search engine, ML)

**Hayır:**
- DB query (connection pool yeter)
- Cache (Redis) — hızlı, restart edilebilir
- Internal computation

## Anti-pattern'ler

### Circuit per-request
```typescript
// ❌ Her request'te yeni breaker
async charge() {
  const breaker = new CircuitBreaker(...);
  return breaker.fire(...);
}
```
State paylaşılmaz → her request kendi sayacı. Singleton.

### Tek breaker tüm external için
```typescript
// ❌ Stripe down → SendGrid de open
const externalBreaker = new CircuitBreaker(callAnyExternal, ...);
```

Per-service ayrı.

### Threshold çok düşük
`errorThresholdPercentage: 5` → flaky network'te sürekli open.

### Fallback business logic
```typescript
breaker.fallback(async () => {
  // Karmaşık alternative payment flow
});
```

Fallback minimal — alternatif provider veya cached response. Karmaşık logic ayrı method'da.

### Open state'i log'lamama
Breaker open → kimse bilmez → user'lar 503 alır → mystery debug.

## Aksiyon

1. Per external service breaker (singleton)
2. opossum kütüphanesi
3. Threshold: 50%, timeout 5s, reset 30s
4. Fallback strategy planla (cached / queue / degraded)
5. Health check'e dahil
6. Prometheus metric event listener'lar
7. Open event → Slack/PagerDuty alert
