---
name: error-handling
keywords: "error, exception, try catch, handle, throw, failure, hata"
description: "Error'ları temiz ve güvenli yönetme"
---

# Error Handling

## Üç yaklaşım

### 1. Throw (exception-based) — backend tercih
```typescript
if (!user) throw new NotFoundException('User not found');
```

Framework'ün exception filter'ı HTTP response'una çevirir. Temiz ama stack trace'i korumak lazım.

### 2. Result type (Rust/Go tarzı) — fonksiyonel
```typescript
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

function findUser(id: string): Result<User, 'NOT_FOUND' | 'DB_ERROR'> {
  ...
}
```

Compiler zorlar — error'u ignore edemezsin. Ama JS/TS'de verbose.

### 3. Nullable dönüş (sadece basit durumlar)
```typescript
function findUser(id: string): User | null;
```

"Yok" ile "hata" aynı görünür — ayırt gerekiyorsa throw veya Result kullan.

**Pratik öneri:**
- Backend REST: throw (NestJS exception filter ile)
- İç service-to-service: throw (ama typed exception class)
- Pure computation: Result type
- UI state: nullable (genelde state null = loading/empty)

## Typed exceptions

Generic `Error`'dan uzak dur. Özel exception class'ları:

```typescript
export class UserNotFoundError extends Error {
  constructor(id: string) {
    super(`User not found: ${id}`);
    this.name = 'UserNotFoundError';
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid credentials');
    this.name = 'InvalidCredentialsError';
  }
}
```

Try/catch içinde tip check:
```typescript
try {
  await userService.getUser(id);
} catch (err) {
  if (err instanceof UserNotFoundError) {
    // 404
  } else if (err instanceof InvalidCredentialsError) {
    // 401
  } else {
    // unexpected — logle, 500
  }
}
```

## Error boundary / global handler

Her framework'te bir "catch-all":
- **NestJS:** Global exception filter
- **Express:** Error handling middleware (4 argümanlı)
- **Next.js App Router:** `error.tsx`
- **React:** Error Boundary component

Bu handler'lar: logla → user-friendly mesaj göster → status code set et.

## Ne loglanır, ne loglanmaz

**Logla:**
- Unexpected errors (500 tarafı)
- Stack trace (dev/staging)
- Request context (user id, path, timestamp)

**Logla ama redact et:**
- Request body (password, token, credit card çıkar)
- Response body (PII varsa)

**Loglama:**
- Expected errors (404, 400) — bunlar metric, log değil
- Password, secret, PII düz halde

## Retry stratejisi

Tüm error'lar retry'lanmaz. Retry'lanabilir error'lar:
- Network timeout
- 503 (service unavailable)
- Database connection hatası (geçici)
- Rate limit (backoff ile)

Retry'lanamayan:
- 400 (bad request) — tekrar denemek çözmez
- 401, 403 (auth) — credentials değişmeden olmaz
- 422 (validation) — aynı girdi aynı sonucu verir

Retry'da **exponential backoff + jitter**:
```typescript
await retry(() => apiCall(), {
  maxAttempts: 3,
  backoff: 'exponential',
  jitter: true,
});
```

## Anti-pattern'ler

**Boş catch**
```typescript
try { await risky(); } catch {}
```
Error yutmak. Hiç olmazsa logle, sonra ignore et.

**Generic `Error` throw**
```typescript
throw new Error('something bad');
```
Typed exception kullan.

**Error'ı string olarak throw**
```typescript
throw 'user not found';
```
Hayır. Her zaman Error instance.

**Nested try/catch**
```typescript
try {
  try {
    ...
  } catch {
    try {
      ...
    } catch { ... }
  }
} catch { ... }
```
Refactor et. Her try/catch tek sorumluluk.

**Catch'te yeniden throw (transparently)**
```typescript
try { await x(); } catch (err) { throw err; }
```
Gereksiz — silersen fark yok. Sadece "logle + throw" yapıyorsan mantıklı.

## Aksiyon

Yeni kod yazarken:
1. Hangi error tipleri olabilir? (listele)
2. Beklenen error (4xx) → typed exception
3. Beklenmeyen error (5xx) → global handler yakalar
4. Her throw için caller'ın ne yapacağı belli mi? (yakalayacak mı, bubble mu edecek)
5. Log'lama — ne yazılır, redact ne gerekir?
6. Retry'lanabilir mi? Policy tanımla.
