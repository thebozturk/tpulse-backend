---
name: security-cors
keywords: "cors, origin, credentials, preflight, cross-origin"
description: "CORS config — origin whitelist, credentials, methods"
---

# CORS

## Ne zaman gerekli

Frontend (browser) + backend farklı origin'lerde:
- `app.acme.com` → `api.acme.com` (cross-subdomain)
- `localhost:3000` → `localhost:4000` (dev)

Same-origin ise CORS gerekmez.

## Basit setup

```typescript
// main.ts
app.enableCors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://app.acme.com', 'https://admin.acme.com']
    : true,  // dev'de her origin OK
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  exposedHeaders: ['X-Total-Count', 'X-Request-ID'],
  maxAge: 3600,
});
```

## origin

### ❌ ÇOK TEHLİKELİ
```typescript
origin: '*',
credentials: true,  // ← yasak kombinasyon
```
Browser bu kombinasyonu zaten reddeder ama yine de yazma — güvenlik standardı ihlali. Security-gate BLOCK eder.

### Whitelist
```typescript
origin: ['https://app.acme.com', 'https://admin.acme.com'],
```

### Dynamic (function)
```typescript
origin: (requestOrigin, callback) => {
  const allowed = ['https://app.acme.com', 'https://admin.acme.com'];
  if (!requestOrigin) return callback(null, true);  // same-origin / curl
  if (allowed.includes(requestOrigin)) return callback(null, true);
  return callback(new Error('CORS blocked'));
},
```

Subdomain support için regex:
```typescript
origin: /^https:\/\/[a-z0-9-]+\.acme\.com$/,
```

## credentials

`true` → cookie'ler ve auth header cross-origin gönderilir.

Gerekli durumlar:
- Session cookie auth
- CORS + httpOnly refresh token cookie

```typescript
credentials: true,
```

Frontend tarafında:
```typescript
fetch('https://api.acme.com/me', {
  credentials: 'include',  // cookie'leri gönder
});
```

## methods

Default: `GET, HEAD, PUT, PATCH, POST, DELETE`.

Restrictive:
```typescript
methods: ['GET', 'POST'],  // sadece read + create
```

## allowedHeaders

Frontend'in gönderebileceği header'lar. Default browser'ın safelisted'i:
- Accept, Accept-Language, Content-Language, Content-Type (bazıları), Range

Custom header'lar explicit:
```typescript
allowedHeaders: [
  'Content-Type',
  'Authorization',
  'X-Request-ID',
  'X-API-Key',
],
```

Unutulursa browser preflight fail, request gitmez.

## exposedHeaders

Frontend'in **okuyabileceği** response header'ları. Default browser sadece safelisted'ı görür:
- Cache-Control, Content-Language, Content-Type, Expires, Last-Modified, Pragma

Custom'ları expose et:
```typescript
exposedHeaders: ['X-Total-Count', 'X-Rate-Limit-Remaining'],
```

## maxAge (preflight cache)

```typescript
maxAge: 3600,  // 1 saat — preflight (OPTIONS) cache'lenir
```

Performance için faydalı. Default 0 (her request'te preflight).

## Preflight (OPTIONS)

Browser `OPTIONS` request gönderir:
- `Access-Control-Request-Method: POST`
- `Access-Control-Request-Headers: Content-Type, Authorization`

NestJS otomatik handle eder. Manual yapmana gerek yok.

## Global vs route-level

Global (çoğu durumda):
```typescript
app.enableCors({ ... });
```

Route-level:
```typescript
// Spesifik endpoint'te farklı CORS
@Controller('webhook')
export class WebhookController {
  // webhook için farklı CORS (başka origin'lerden)
}
```

Nadir gerekli. Global yeterli.

## Subdomain CORS

`api.acme.com` ile `app.acme.com` farklı origin. `*.acme.com` wildcard regex ile.

Same-domain (ikisi de `acme.com`) ise path-based (`/api/*` backend, `/app/*` frontend) CORS gereksiz — reverse proxy kullan.

## WebSocket CORS

WebSocket upgrade request CORS header'larına bakmaz (Origin header'ı kontrol edilmez tarayıcılar tarafından). Server-side Origin validation YAP:
```typescript
@WebSocketGateway({
  cors: {
    origin: 'https://app.acme.com',
    credentials: true,
  },
})
```

## Dev vs prod

Dev:
```typescript
origin: true,  // her origin
credentials: true,
```

Prod:
```typescript
origin: ['https://app.acme.com'],
credentials: true,
```

## Anti-pattern'ler

### `*` + credentials
```typescript
// ❌ Browser zaten reject eder, kod düşen güvenlik sinyali
origin: '*',
credentials: true,
```

### Reflect all origins
```typescript
// ❌ "Origin ne geldiyse kabul et"
origin: (req, cb) => cb(null, req.header('Origin'))
```

### CORS auth yerine kullanma
CORS **bypass kontrolü değil**. Origin header client tarafında manipüle edilebilir (curl'de `-H "Origin: ..."`). Sadece browser policy.

Auth'u backend-side kontrol et (JWT, session).

### Preflight cache uzun
```typescript
maxAge: 86400  // 24 saat — policy değiştirdikten sonra user 24 saat eski CORS'la yaşar
```

## Aksiyon

1. Prod'da origin whitelist (explicit liste)
2. credentials: true httpOnly cookie için
3. Custom header'lar allowedHeaders'a
4. Custom response header'lar exposedHeaders'a
5. maxAge 1 saat (1-3600)
6. CORS auth'u replace etmez — her endpoint'te guard
