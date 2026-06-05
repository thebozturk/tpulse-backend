---
name: security-csrf
keywords: "CSRF, XSRF, sameSite, double-submit, cross-site request forgery"
description: "CSRF koruması — SameSite + double-submit token"
---

# CSRF (Cross-Site Request Forgery)

## Saldırı senaryosu

User logged in `bank.com`, cookie var.
User `evil.com` ziyaret eder. evil.com'da:
```html
<img src="https://bank.com/transfer?to=hacker&amount=1000" />
```

Browser otomatik bank.com cookie'sini ekler → istek geçer → para gider.

CSRF cookie-based auth + browser otomatik cookie attachment'ı sömürür.

## Risk altındakiler

- **Risk YÜKSEK:** Session cookie auth (web app)
- **Risk YOK:** JWT in Authorization header (mobile, SPA)
  - Browser otomatik header eklemez
  - Cross-origin fetch CORS bloklar (default)

JWT in cookie kullanıyorsan: risk var.

## Çözüm 1: SameSite cookie (modern, basit)

```typescript
res.cookie('refresh-token', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',  // ← CSRF protection
  maxAge: 7 * 24 * 3600 * 1000,
});
```

### sameSite değerleri

- **strict:** Cookie sadece same-site request'lerde gönderilir. Cross-site link click'inde bile cookie YOK.
- **lax:** Cross-site GET (link click) cookie OK; POST/PUT/DELETE değil. Default browser behavior 2024+.
- **none:** Her yerde gönderilir. `secure: true` zorunlu. Cross-origin gerekli durumlarda (örn. embedded payment).

**Tercih:**
- API'de `strict`
- Login redirect (OAuth) gerekiyorsa `lax`
- Embedded iframe / cross-origin must → `none` + ek koruma

## Çözüm 2: Double-submit token (klasik)

Token iki yerde:
1. **Cookie** (browser otomatik gönderir)
2. **Custom header** (frontend manuel ekler)

Cross-origin attacker cookie'yi okuyamaz → header'ı set edemez → mismatch.

### Setup

```typescript
import { randomBytes } from 'crypto';

@Injectable()
export class CsrfService {
  generateToken(): string {
    return randomBytes(32).toString('hex');
  }
}

// Login'de
@Post('login')
async login(@Res() res: Response) {
  const csrfToken = this.csrfService.generateToken();

  res.cookie('csrf-token', csrfToken, {
    httpOnly: false,        // JS okumalı (header'a koyacak)
    secure: true,
    sameSite: 'strict',
    maxAge: 24 * 3600 * 1000,
  });

  res.json({ ok: true });
}
```

### Validate (mutating endpoints)

```typescript
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();

    // GET/HEAD safe — skip
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;

    const cookieToken = req.cookies['csrf-token'];
    const headerToken = req.headers['x-csrf-token'];

    if (!cookieToken || !headerToken) {
      throw new ForbiddenException('CSRF token missing');
    }
    if (cookieToken !== headerToken) {
      throw new ForbiddenException('CSRF token mismatch');
    }

    return true;
  }
}

// Apply
@UseGuards(CsrfGuard)
@Controller('api')
```

### Frontend

```typescript
// Cookie oku
const token = document.cookie
  .split('; ')
  .find(r => r.startsWith('csrf-token='))
  ?.split('=')[1];

// Her mutating request'te header
fetch('/api/transfer', {
  method: 'POST',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': token,
  },
  body: JSON.stringify({ ... }),
});
```

## Çözüm 3: Origin / Referer check

```typescript
@Injectable()
export class OriginCheckGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (['GET', 'HEAD'].includes(req.method)) return true;

    const origin = req.headers.origin || req.headers.referer;
    const allowed = ['https://app.acme.com', 'https://admin.acme.com'];

    if (!origin || !allowed.some(a => origin.startsWith(a))) {
      throw new ForbiddenException('Invalid origin');
    }
    return true;
  }
}
```

Basit ama: bazı user'lar Referer header'ı disable eder (privacy extension), o user'ın istekleri reject olur. Kombinasyon (SameSite + Origin) tercih.

## Hangi çözüm hangi durumda

| Senaryo | Çözüm |
|---------|-------|
| Modern SPA + JWT in header | CSRF risk yok |
| Cookie session, sadece same-site | SameSite strict |
| Cookie auth + cross-subdomain (app + admin) | SameSite strict + double-submit |
| Embedded widget (cross-origin iframe) | SameSite none + double-submit + Origin check |

## CSRF kütüphaneleri

`csurf` paketi NestJS'te kullanılabilir:
```bash
pnpm add csurf
```

```typescript
import * as csurf from 'csurf';
app.use(csurf({ cookie: true }));
```

Modern projelerde manuel SameSite + custom guard tercih.

## Anti-pattern'ler

### CSRF protection sadece signed-in user için
```typescript
if (req.user) { /* check CSRF */ }
```
Login endpoint'in kendisi CSRF saldırılarına açık (login CSRF — kurban hacker hesabıyla giriş yapar). Login'e de CSRF check.

### SameSite none + secret cookie
```typescript
sameSite: 'none', secure: true,
// + token cookie (CSRF için)
```
SameSite none ise CSRF zaten gerekiyor. Ama bu durumda double-submit zorunlu.

### Double-submit cookie httpOnly
```typescript
httpOnly: true  // ❌ JS okuyamaz, header'a koyamaz
```
CSRF token cookie'si **httpOnly OLMAMALI** (refresh token cookie httpOnly OLMALI — ikisi farklı).

### GET endpoint mutating
```typescript
@Get('delete-user/:id')  // ❌ CSRF açık (img src ile çağrılır)
```
GET sadece read. Mutating → POST/DELETE.

## Aksiyon

1. SameSite strict (cookie-based auth)
2. JWT in header (Bearer) — CSRF yok
3. SameSite none gerekiyorsa → double-submit token
4. Login endpoint'inde de CSRF check (login CSRF)
5. Mutating GET YOK
6. CSRF token httpOnly:false (JS okumalı)
7. Refresh token httpOnly:true (XSS koruması)
