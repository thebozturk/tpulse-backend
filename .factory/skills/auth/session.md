---
name: auth-session
keywords: "session, redis, cookie, express-session, csrf"
description: "Server-side session (JWT alternatifi)"
---

# Session (JWT alternatifi)

## Ne zaman session, ne zaman JWT

| Kriter | Session | JWT |
|--------|---------|-----|
| Stateful server | ✓ | ✗ |
| Logout revoke | ✓ (hemen) | Zor (blacklist) |
| Scale (horizontal) | Redis lazım | ✓ (stateless) |
| Mobile API | Ek setup | ✓ native |
| Microservice | Her service state'i paylaşmalı | ✓ |
| Admin panel | Basit | Overkill |

**Karar:** Mobil / SPA / microservice → JWT. Pure web admin / traditional → Session.

Karma yaklaşım:
- Web: session cookie
- Mobile/API: JWT

## Setup (Redis store)

```bash
pnpm add express-session connect-redis ioredis
pnpm add -D @types/express-session
```

```typescript
// main.ts
import * as session from 'express-session';
import RedisStore from 'connect-redis';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

app.use(
  session({
    store: new RedisStore({ client: redis, prefix: 'sess:' }),
    secret: process.env.SESSION_SECRET,  // 32+ char
    name: 'sid',  // 'connect.sid' default — değiştir (fingerprint önlemi)
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',  // HTTPS only
      sameSite: 'strict',  // CSRF önlemi
      maxAge: 24 * 3600 * 1000,  // 1 gün
    },
    rolling: true,  // Her request'te extend
  }),
);
```

## Session data

Minimal:
```typescript
// Login
req.session.userId = user._id.toString();
req.session.roles = user.roles;

// Kullanım
@Get('me')
async me(@Req() req: Request) {
  if (!req.session.userId) throw new UnauthorizedException();
  return this.userService.findById(req.session.userId);
}
```

**Tüm user objesini session'a koyma** — Redis'te yer kaplar. Sadece id, sonra DB'den çek.

## Guard (NestJS)

```typescript
@Injectable()
export class SessionAuthGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    if (!req.session?.userId) throw new UnauthorizedException();
    return true;
  }
}
```

## Session fixation önlemi

Login'den sonra session ID regenerate:

```typescript
@Post('login')
async login(@Req() req: Request, @Body() dto: LoginDto) {
  const user = await this.authService.validate(dto.email, dto.password);

  // ESKİ session id'sini kapat, YENİSİ oluştur
  await new Promise<void>((resolve, reject) => {
    req.session.regenerate((err) => err ? reject(err) : resolve());
  });

  req.session.userId = user._id.toString();
  req.session.roles = user.roles;

  await new Promise<void>((resolve, reject) => {
    req.session.save((err) => err ? reject(err) : resolve());
  });

  return { user };
}
```

Önceki (attacker'ın bildiği) session id artık geçerli değil.

## Logout

```typescript
@Post('logout')
async logout(@Req() req: Request, @Res() res: Response) {
  req.session.destroy((err) => {
    if (err) throw new InternalServerErrorException();
    res.clearCookie('sid');
    res.json({ ok: true });
  });
}
```

## CSRF koruması

Session cookie = CSRF açığı. İki çözüm:

### 1. SameSite strict (tercih)

```typescript
cookie: { sameSite: 'strict' }
```

Tarayıcı cross-site request'te cookie göndermez. OAuth redirect vb. durumda `lax` gerekli.

### 2. Double-submit token

```typescript
// Login'de
const csrfToken = randomUUID();
req.session.csrfToken = csrfToken;
res.cookie('csrf-token', csrfToken, { httpOnly: false, sameSite: 'strict' });

// Mutating endpoint'te
@Post('sensitive-op')
async op(@Req() req: Request, @Headers('x-csrf-token') token: string) {
  if (token !== req.session.csrfToken) {
    throw new ForbiddenException('Invalid CSRF token');
  }
  // ...
}
```

Frontend her POST/PUT/PATCH'te `X-CSRF-Token` header'ı cookie'den kopyalar.

## Concurrent sessions

User birden fazla cihazdan login. Default her cihaz ayrı session. Limit istenirse:

```typescript
// Login'de user'ın tüm session key'lerini bul
const keys = await redis.keys(`sess:*`);
let activeCount = 0;
for (const key of keys) {
  const data = await redis.get(key);
  if (data?.includes(`"userId":"${user._id}"`)) activeCount++;
}

if (activeCount >= 3) {
  // En eski session'u sil veya login reddet
}
```

## Session sabit süre vs rolling

- **Fixed:** Login'den 24 saat sonra expire
- **Rolling:** Her request'te süreyi uzat — aktif kullanıcı deniyet bitmez

`rolling: true` tercih (aktif user sürekli session yeniler).

## Anti-pattern'ler

### Session'da sensitive data
```typescript
// ❌ Redis leak → password hash'ler, token'lar
req.session.password = hash;
req.session.creditCard = ...;
```

### Default cookie name
```typescript
// ❌ 'connect.sid' — attacker express kullandığını bilir
// ✓ 'sid' veya custom
name: 'sid'
```

### httpOnly false
```typescript
cookie: { httpOnly: false }  // ❌ JS okur, XSS çalar
```

### sameSite yok
```typescript
cookie: { sameSite: undefined }  // ❌ browser defaults, CSRF risk
```

### Session store memory'de (prod)
```typescript
// ❌ Multi-instance'ta session farklı pod'larda
session({ /* no store */ })  // default MemoryStore
```

### Regenerate etmeme
Login sonrası eski session id ile saldırı.

## Aksiyon

1. Redis store (prod)
2. httpOnly + secure + sameSite: 'strict'
3. Session ID regenerate (login sonrası)
4. Minimum data (userId + roles)
5. rolling: true (aktif user için)
6. Logout = destroy + clearCookie
7. CSRF: sameSite + opsiyonel double-submit
