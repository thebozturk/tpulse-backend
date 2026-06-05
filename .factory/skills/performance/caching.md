---
name: performance-caching
keywords: "cache, redis, cache-aside, ttl, invalidation, memoize"
description: "Caching pattern'ları — Redis, cache-aside, invalidation"
---

# Caching

## Cache-aside pattern

```typescript
@Injectable()
export class UserService {
  async getById(id: string): Promise<User> {
    // 1. Cache'e bak
    const cached = await this.cache.get(`user:${id}`);
    if (cached) return JSON.parse(cached);

    // 2. DB'den çek
    const user = await this.userModel.findById(id).lean();
    if (!user) throw new NotFoundException();

    // 3. Cache'e koy
    await this.cache.set(`user:${id}`, JSON.stringify(user), 'EX', 300);  // 5dk

    return user;
  }

  async update(id: string, dto: UpdateDto): Promise<User> {
    const user = await this.userModel.findByIdAndUpdate(id, dto, { new: true }).lean();
    // 4. Invalidate
    await this.cache.del(`user:${id}`);
    return user;
  }
}
```

## TTL stratejisi

- **Static data** (currency rates, country list) → 1 saat - 1 gün
- **User profile** → 5-15 dk
- **Hot leaderboard** → 10-60 sn
- **Session** → user activity süresi (rolling)

## Invalidation

Üç stratej:
1. **Time-based (TTL):** Otomatik expire
2. **Event-based:** Update sırasında `cache.del`
3. **Version key:** `user:123:v2` — version bump = yeni key

Combine: TTL + event invalidation.

## Tags / wildcard delete

```typescript
// Pattern delete (Redis SCAN — production safe)
async deleteByPattern(pattern: string) {
  const stream = this.redis.scanStream({ match: pattern });
  stream.on('data', async (keys) => {
    if (keys.length) await this.redis.del(...keys);
  });
}

// Kullanım
await this.deleteByPattern('user:123:*');
```

`KEYS *` production'da YASAK — blocking. `SCAN` non-blocking.

## Cache stampede önlemi

100 user aynı anda cache miss → 100 DB query.

```typescript
const lockKey = `lock:user:${id}`;
const lock = await this.redis.set(lockKey, '1', 'NX', 'EX', 5);

if (lock) {
  // First request → DB'yi sorgular
  const user = await this.userModel.findById(id).lean();
  await this.cache.set(`user:${id}`, JSON.stringify(user), 'EX', 300);
  await this.redis.del(lockKey);
  return user;
} else {
  // Diğerleri → bekle
  await new Promise(r => setTimeout(r, 100));
  return this.getById(id);  // retry — cache'de olmalı şimdi
}
```

## Anti-pattern'ler

### Cache büyük objeler
- 5MB user obje cache'leme — Redis memory patlar.

### Stale data unawareness
- TTL 1 saat ama user "isim güncellendi 1 saat görünmüyor" şikayet eder.

### KEYS * production'da
- Blocking, Redis fail. SCAN kullan.

### Sensitive data cache
- Password, token Redis'te plain → leak.

## Aksiyon

1. Cache-aside pattern
2. TTL ile auto-expire
3. Update'te invalidate
4. Stampede protection (lock)
5. SCAN delete-by-pattern
6. Sensitive data cache'leme
