---
name: security-helmet
keywords: "helmet, CSP, HSTS, security headers, headers, content-security-policy"
description: "HTTP security headers — Helmet setup ve config"
---

# Helmet (Security Headers)

## Setup

```bash
pnpm add helmet
```

```typescript
// main.ts
import helmet from 'helmet';

app.use(helmet());  // default preset
```

Tek satırla çoğu önemli header aktif.

## Default Helmet ne yapar

Helmet 15+ header set eder:
- `X-Content-Type-Options: nosniff` — MIME sniffing kapalı
- `X-Frame-Options: SAMEORIGIN` — clickjacking önlemi (CSP frame-ancestors daha modern)
- `Strict-Transport-Security` — HTTPS enforce (HSTS)
- `Content-Security-Policy` — default strict preset
- `X-DNS-Prefetch-Control: off`
- `X-Download-Options: noopen`
- `X-Permitted-Cross-Domain-Policies: none`
- `Referrer-Policy: no-referrer`
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Resource-Policy: same-origin`

## CSP — en önemli

Cross-Site Scripting (XSS) önleme. Browser'a hangi kaynakları yüklemesine izin verdiğini söyler.

### Production config
```typescript
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'sha256-ABC...'"],  // inline script hash
        styleSrc: ["'self'", "'unsafe-inline'"],   // CSS inline bazen gerekli
        imgSrc: ["'self'", 'data:', 'https://cdn.acme.com'],
        connectSrc: ["'self'", 'https://api.acme.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        frameAncestors: ["'none'"],                 // clickjacking
        formAction: ["'self'"],
        upgradeInsecureRequests: [],
      },
    },
  }),
);
```

### API-only backend

Backend sadece API dönüyorsa:
```typescript
helmet({
  contentSecurityPolicy: false,  // browser UI yok, CSP gereksiz
})
```

Ama `/api/docs` Swagger varsa CSP gerekli.

## HSTS (HTTPS enforce)

```typescript
helmet({
  strictTransportSecurity: {
    maxAge: 31536000,       // 1 year
    includeSubDomains: true,
    preload: true,           // HSTS preload list'e ekle
  },
})
```

**HSTS preload** — tarayıcılar listede olan domain'i asla HTTP'den ziyaret etmez. https://hstspreload.org'a başvur.

**Dikkat:** Yanlışlıkla production'da HTTPS devre dışı bırakırsan 1 yıl erişim kaybı.

## X-Frame-Options vs frame-ancestors

- `X-Frame-Options: SAMEORIGIN` — eski
- `Content-Security-Policy: frame-ancestors 'none'` — yeni

Yeni tercih. Helmet ikisini de koyar.

## Referrer-Policy

User başka site'ye clic ettiğinde Referer header:
- `no-referrer` — hiç gönderme
- `no-referrer-when-downgrade` — HTTPS→HTTP değilse gönder
- `strict-origin` — sadece origin (path yok)
- `strict-origin-when-cross-origin` — same-origin full, cross strict

Hassas URL path'leri varsa `no-referrer`.

## Permissions-Policy (yeni)

Feature'ları kısıtla:
```typescript
helmet({
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
});

// Manuel header
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  next();
});
```

## CSP violation reporting

Browser CSP ihlalini bildirir:
```typescript
directives: {
  ...
  reportUri: ['/csp-report'],
}
```

Endpoint:
```typescript
@Post('csp-report')
@Public()
async cspReport(@Body() report: any) {
  this.logger.warn('CSP violation', report);
  // veya Sentry'ye gönder
}
```

Production'da XSS attempt'leri tespit eder.

## Dev vs Prod

Dev'de Swagger, React DevTools için CSP relax:
```typescript
if (process.env.NODE_ENV === 'production') {
  app.use(helmet({ contentSecurityPolicy: { /* strict */ } }));
} else {
  app.use(helmet({ contentSecurityPolicy: false }));  // dev için kapalı
}
```

## Test etme

Production'da header'ları doğrula:
```bash
curl -I https://api.acme.com/
# Kontrol:
# Strict-Transport-Security: max-age=31536000; includeSubDomains
# X-Content-Type-Options: nosniff
# Content-Security-Policy: ...
```

Online tool: https://securityheaders.com — scan, A+ hedef.

## Anti-pattern'ler

### CSP unsafe-eval / unsafe-inline
```typescript
scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"]  // ❌ XSS korumayı bypass eder
```

Inline script'ler için hash veya nonce kullan.

### HSTS preload + subdomain kontrol etmeden
```typescript
strictTransportSecurity: { preload: true, includeSubDomains: true }
// ❌ www.acme.com HTTP-only ise erişilmez olur
```

### Helmet skip
```typescript
// ❌ "sonra eklerim" — production'a çıkar
// app.use(helmet());
```

## Aksiyon

1. `helmet()` default preset ekle
2. CSP policy'yi frontend ihtiyacına göre kur
3. HSTS production'da zorunlu
4. CSP violation reporting (prod'da log)
5. securityheaders.com ile test
6. Feature'ları Permissions-Policy ile kısıtla
