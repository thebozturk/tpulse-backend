---
name: performance-connection-pool
keywords: "connection pool, mongoose, redis, max connections, tuning"
description: "Connection pool tuning"
---

# Connection Pool

## Mongoose pool

```typescript
MongooseModule.forRoot(uri, {
  maxPoolSize: 100,        // default 100
  minPoolSize: 10,         // hot pool
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 30_000,
  maxIdleTimeMS: 60_000,    // 1 dk idle → close
});
```

Pool size = aynı anda max kaç query.

## Tuning

### Çok küçük → connection wait
```
poolSize: 5, concurrent requests: 100
→ 95 request bekler
```

### Çok büyük → DB overload
```
poolSize: 1000, MongoDB max conn: 500
→ DB reject
```

### Hesaplama
```
poolSize ≈ (avg query duration) × (target QPS)
Örn: 50ms query, 500 QPS → 25 connection
```

`db.serverStatus()` ile DB tarafında active conn izle.

## Multi-instance

10 pod, her biri 100 pool → 1000 connection toplam. DB max'i geçme.

```
DB max: 500
Pod count: 10
Per-pod pool: 50  (10 × 50 = 500)
```

## Pool partition

Critical (auth) ve background (analytics) ayrı pool. Bkz. `resilience/bulkhead.md`.

## Redis pool

ioredis default tek connection (multiplexed). Cluster:
```typescript
const redis = new Redis.Cluster([...], {
  redisOptions: { connectTimeout: 5000 },
  scaleReads: 'slave',  // read replica'dan
});
```

## Aksiyon

- Pool size = concurrent QPS × avg duration
- Multi-pod toplam ≤ DB max
- minPoolSize warmup için
- Idle timeout 60s
