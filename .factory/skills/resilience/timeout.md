---
name: resilience-timeout
keywords: "timeout, deadline, abort, request, slow"
description: "Per-layer timeout — backend, DB, external"
---

# Timeout

## Layered timeout

Her layer kendi timeout'una sahip. Toplamı request budget'ı:

```
Client request → 30s budget
  ↓
Backend HTTP timeout → 25s
  ↓
Service method → 20s
  ↓
DB query → 5s
External API → 10s
Cache → 1s
```

Inner timeout outer'dan kısa olmalı. Yoksa outer önce timeout yapar, inner asılı kalır.

## HTTP server timeout

NestJS'te:
```typescript
// main.ts
const server = app.getHttpServer();
server.setTimeout(30_000);  // 30s
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;  // > keepAliveTimeout
```

Reverse proxy (nginx) timeout backend'inkinden YÜKSEK olmalı:
```
nginx: 60s
backend: 30s
```

Yoksa nginx 504 verir, backend hala çalışıyor olabilir.

## Mongoose timeout

```typescript
MongooseModule.forRoot(uri, {
  serverSelectionTimeoutMS: 5_000,    // İlk connection
  socketTimeoutMS: 30_000,             // Idle connection
  maxPoolSize: 10,
});
```

Per-query timeout:
```typescript
await this.userModel.find({ status: 'active' })
  .maxTimeMS(2000)  // 2s — query çok uzun sürerse abort
  .lean();
```

## HTTP client timeout

axios:
```typescript
const client = axios.create({
  baseURL: 'https://api.acme.com',
  timeout: 5_000,  // 5s
});
```

fetch (Node 18+):
```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 5000);

try {
  const res = await fetch(url, { signal: controller.signal });
  return await res.json();
} finally {
  clearTimeout(timeoutId);
}
```

## NestJS interceptor

Global timeout:
```typescript
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      timeout(20_000),
      catchError((err) => {
        if (err instanceof TimeoutError) {
          return throwError(() => new RequestTimeoutException());
        }
        return throwError(() => err);
      }),
    );
  }
}

// app.module.ts
{ provide: APP_INTERCEPTOR, useClass: TimeoutInterceptor }
```

20s'den uzun sürerse 408 dön.

## Per-endpoint timeout

```typescript
@Post('upload')
@UseInterceptors(TimeoutInterceptor)  // file upload uzun
async upload() { ... }
```

Veya method-level:
```typescript
intercept(ctx, next) {
  const handler = ctx.getHandler();
  const customTimeout = Reflect.getMetadata('timeout', handler) || 20_000;
  return next.handle().pipe(timeout(customTimeout));
}

@Timeout(60_000)  // custom decorator
@Post('big-export')
```

## Cascade prevention

Backend timeout 20s, ama 100 concurrent request 20s asılı kalırsa thread pool dolu. Connection refused.

**Çözüm:** Hızlı timeout + bulkhead.

## Deadline propagation

Distributed system'de upstream'den gelen deadline'ı downstream'e ilet:
```typescript
@Post('order')
async createOrder(@Headers('x-deadline-ms') deadline: string) {
  const remaining = parseInt(deadline) - Date.now();
  if (remaining <= 0) throw new RequestTimeoutException();

  // Downstream call'a remaining geçir
  await axios.post('/payment', data, { timeout: Math.min(remaining, 5000) });
}
```

Tüm zincire deadline → kimse upstream'in zaten gone olduğu request'e zaman harcamaz.

## Timeout vs cancellation

Timeout sadece **bekleme**. Operation devam eder (server tarafında):
```typescript
const promise = slowDbQuery();
setTimeout(() => promise.cancel?.(), 5000);  // çoğu library cancel desteklemez
```

MongoDB `maxTimeMS` aslında **server-side timeout** — query MongoDB'de cancel edilir.

HTTP'de AbortController → request gerçekten cancel.

## Anti-pattern'ler

### Timeout yok
```typescript
await axios.get(url);  // ❌ 30 dakika beklenebilir
```

### Timeout çok yüksek
```typescript
{ timeout: 600_000 }  // ❌ 10 dakika — connection pool tıkar
```
Realistic upper bound.

### Inner > outer
```
nginx 5s, backend 30s
```
nginx 504 atar, backend boşuna devam eder.

### Per-query yok
```typescript
await userModel.aggregate([...complex pipeline...]);
// ❌ pipeline 60s sürerse connection asılı
```
`maxTimeMS` ekle.

### Timeout error generic
```typescript
catch (err) {
  if (err.message.includes('timeout')) ...  // ❌ string match
}
```

Specific exception class veya error code.

## Aksiyon

1. HTTP server timeout (NestJS server.setTimeout)
2. Mongoose connection + per-query timeout
3. HTTP client timeout (axios, fetch)
4. Interceptor ile global request timeout
5. Inner < outer kuralı
6. Slow endpoint için custom timeout
7. AbortController ile gerçek cancellation
