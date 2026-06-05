---
name: resilience-retry
keywords: "retry, exponential backoff, jitter, transient error, axios"
description: "Retry stratejisi — exponential backoff + jitter"
---

# Retry

## Hangi error'lar retry'lanır

**Evet (transient):**
- Network timeout, ECONNRESET, ETIMEDOUT
- HTTP 408, 502, 503, 504
- Rate limit 429 (with backoff)
- Database connection error (geçici)

**Hayır (permanent):**
- HTTP 400 (bad request) — aynı request aynı sonuç
- HTTP 401, 403 (auth) — credential değişmeden çözmez
- HTTP 404, 410 — resource yok
- HTTP 422 (validation)
- Business logic error

## Exponential backoff

İlk fail → 100ms bekle → 200ms → 400ms → 800ms.

```
attempt 1: 100ms
attempt 2: 200ms
attempt 3: 400ms
attempt 4: 800ms
attempt 5: 1600ms
```

Constant interval (her seferinde 1s) → thundering herd. Exponential daha sağlıklı.

## Jitter

Tüm client'lar aynı anda retry yapar → server bombardımanı. Random jitter:
```typescript
delay = baseDelay * 2^attempt + random(0, baseDelay)
```

Veya "full jitter":
```typescript
delay = random(0, baseDelay * 2^attempt)
```

Tercih: full jitter — load distribution daha iyi.

## Manual implementation

```typescript
async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    isRetryable?: (err: any) => boolean;
  } = {},
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 100,
    maxDelayMs = 10000,
    isRetryable = defaultIsRetryable,
  } = options;

  let lastErr: any;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === maxAttempts || !isRetryable(err)) throw err;

      const exponential = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      const jittered = Math.random() * exponential;
      await new Promise(r => setTimeout(r, jittered));
    }
  }
  throw lastErr;
}

function defaultIsRetryable(err: any): boolean {
  // Network
  if (['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED'].includes(err.code)) return true;
  // HTTP
  if ([408, 429, 502, 503, 504].includes(err.response?.status)) return true;
  return false;
}
```

Kullanım:
```typescript
const result = await retry(
  () => axios.get('https://api.acme.com/data'),
  { maxAttempts: 3, baseDelayMs: 200 },
);
```

## Library: p-retry

```bash
pnpm add p-retry
```

```typescript
import pRetry, { AbortError } from 'p-retry';

const result = await pRetry(
  async () => {
    const res = await axios.get(url);
    if (res.status === 404) throw new AbortError('Not found');  // permanent
    return res.data;
  },
  {
    retries: 3,
    minTimeout: 200,
    factor: 2,
    randomize: true,  // jitter
  },
);
```

## Axios interceptor

```typescript
import axiosRetry from 'axios-retry';

axiosRetry(axios, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (err) => {
    return axiosRetry.isNetworkOrIdempotentRequestError(err) ||
           err.response?.status === 429;
  },
});
```

GET, HEAD, OPTIONS, PUT, DELETE idempotent — auto retry.
POST default retry'lanmaz (aynı POST 2 kez = 2 charge).

## Idempotency key

POST'u retry-safe yap:
```typescript
@Post('payments')
async createPayment(@Body() dto: CreatePaymentDto, @Headers('idempotency-key') key: string) {
  if (!key) throw new BadRequestException('Idempotency-Key required');

  const existing = await this.paymentModel.findOne({ idempotencyKey: key });
  if (existing) return existing;  // Same key → same result

  // Process payment, save with key
  const payment = await this.paymentModel.create({ ...dto, idempotencyKey: key });
  return payment;
}
```

Client retry yaparsa aynı key, server "zaten yaptım" der.

## Retry-After header (429)

```typescript
async function smartRetry(fn, attempt) {
  try {
    return await fn();
  } catch (err) {
    if (err.response?.status === 429) {
      const retryAfter = parseInt(err.response.headers['retry-after']) || 60;
      await new Promise(r => setTimeout(r, retryAfter * 1000));
      return smartRetry(fn, attempt + 1);
    }
    throw err;
  }
}
```

Server "30s sonra dene" diyor → buna saygı göster.

## Circuit breaker + retry

Retry'lar arasında circuit breaker:
```typescript
async charge() {
  return retry(
    () => this.breaker.fire(...),  // Breaker open ise hemen fail
    { maxAttempts: 3 },
  );
}
```

Breaker open ise retry de hızlı fail eder (downstream'e dokunmadan).

## Anti-pattern'ler

### Sınırsız retry
```typescript
while (true) {
  try { await fn(); break; } catch {}
}
```
Asla. Max attempt + max time budget.

### Aynı interval
```typescript
setTimeout(retry, 1000);  // her seferinde 1s
```
Thundering herd. Exponential + jitter.

### 4xx retry
```typescript
if (err.response?.status >= 400) retry();
```
400 retry → aynı 400. Sadece transient.

### POST retry idempotency-key olmadan
Duplicate charges, double-orders.

### Retry'ın kendisi yavaş
```typescript
sleep(60_000);  // 1 dakika bekle
// Total wait: 1+2+4 = 7 dakika sonra fail döner
```
Total budget kontrol et. Max 30s gibi.

## Aksiyon

1. p-retry veya custom helper
2. Exponential backoff + jitter
3. Idempotent operations (GET, PUT, DELETE) auto retry
4. POST: idempotency key veya manuel
5. 4xx retry'lama (sadece transient)
6. Retry-After header'a saygı
7. Circuit breaker ile combine
8. Max total time budget (30s gibi)
