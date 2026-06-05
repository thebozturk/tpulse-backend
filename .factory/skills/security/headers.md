---
name: security-headers
keywords: "headers, response, X-Frame, security headers, hsts, csp"
description: "HTTP response security headers — Helmet ötesi"
---

# Security Headers (Helmet ötesi)

## Helmet'in koymadıkları

Helmet çoğunu halleder ama bazıları manual:

### Permissions-Policy (eski Feature-Policy)

Browser feature'larını kısıtla:
```typescript
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), midi=()'
  );
  next();
});
```

User izinsiz camera/mic erişemez (XSS bile yapsa).

### Cross-Origin-Embedder-Policy (COEP)

```typescript
res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
```

Cross-origin resource'lar explicit izin (CORP header) ister. Spectre/Meltdown koruma. Browser'da `SharedArrayBuffer` etkinleştirir.

**Dikkat:** External image'ler kırılabilir — CORP header eksikse. CDN'inde set et.

### Cross-Origin-Opener-Policy (COOP)

```typescript
res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
```

`window.opener` ile cross-origin manipülasyon engelli (tabnabbing).

### Cross-Origin-Resource-Policy (CORP)

```typescript
res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
```

Backend'in serve ettiği resource'ları cross-origin tarafından embed etmek yasak.

API için: `same-origin`. Public CDN için: `cross-origin`.

## Server header sızıntısı

```
Server: nginx/1.18.0
X-Powered-By: Express
```

Attacker'a versiyon bilgisi → known CVE'lere karşı hedefler.

```typescript
// Express
app.disable('x-powered-by');

// nginx
server_tokens off;
```

## Cache-Control

Hassas response cache'lenmesin:
```typescript
@Get('me')
async me(@Res({ passthrough: true }) res: Response) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  return this.userService.findById(...);
}
```

CDN/proxy yanlışlıkla cache'lerse bir user başkasının verisini görür.

## Content-Type

API JSON dönüyor:
```typescript
res.setHeader('Content-Type', 'application/json; charset=utf-8');
```

NestJS otomatik koyar ama doğru `charset=utf-8` zorunlu (XSS'te encoding trick'leri için).

## X-Robots-Tag

Backend API search engine'lere indekslenmesin:
```typescript
res.setHeader('X-Robots-Tag', 'noindex, nofollow');
```

## Custom security header

Internal tracking için:
```typescript
res.setHeader('X-Request-ID', requestId);
```

`X-Request-ID` log correlation için (interceptor ekler).

## Header set edilmesi gerekmeyenler (anti-pattern)

### X-XSS-Protection (deprecated)
```
X-XSS-Protection: 1; mode=block  ❌
```
Eskiden tarayıcı XSS filter'ı için. Modern browser'lar artık ignore eder. CSP yeter.

### Public-Key-Pins (HPKP)

Deprecated. Cert misconfiguration'da site erişilmez. Bunun yerine CT (Certificate Transparency).

## Test

```bash
curl -I https://api.acme.com/

# Beklenen header'lar (Helmet + custom):
# Strict-Transport-Security: max-age=31536000; includeSubDomains
# X-Content-Type-Options: nosniff
# X-Frame-Options: SAMEORIGIN (veya CSP frame-ancestors)
# Content-Security-Policy: ...
# Referrer-Policy: no-referrer
# Cross-Origin-Opener-Policy: same-origin
# Permissions-Policy: camera=(), ...
# Cache-Control: no-store (login response için)
```

Online test:
- https://securityheaders.com — A+ hedef
- https://observatory.mozilla.org

## Comprehensive setup

```typescript
// main.ts
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: { /* prod config */ },
  strictTransportSecurity: { maxAge: 31536000, includeSubDomains: true, preload: true },
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginEmbedderPolicy: false,  // gerekirse aç
  crossOriginResourcePolicy: { policy: 'same-origin' },
  referrerPolicy: { policy: 'no-referrer' },
}));

// Custom additions
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  next();
});

// Express'in X-Powered-By kapat
app.getHttpAdapter().getInstance().disable('x-powered-by');
```

## Aksiyon

1. Helmet default + custom headers
2. Permissions-Policy ile feature kısıtla
3. Cache-Control no-store auth response'larında
4. X-Powered-By disable
5. CORS + COOP + CORP doğru config
6. Test: securityheaders.com A+ hedef
7. Server version expose ETME
