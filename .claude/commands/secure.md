# /secure — Güvenlik Audit

$ARGUMENTS: Opsiyonel — kapsam. `full` (varsayılan) / `auth` / `deps` / `secrets` / `headers`.

## Amaç

Security-dev agent'ını çağırır. Proje genelinde güvenlik açıklarını tarar, kategori bazlı rapor verir. **Kod değiştirmez** — sadece tespit + öneri.

## Protocol

1. **KAPSAM** — Ne audit edilecek
2. **DELEGE** — security-dev agent'ı çalıştır
3. **RAPORLA** — Severity bazlı sorunlar
4. **ÖNER** — Düzeltme için /build veya manuel plan

## Context Bütçesi: Max 20k token

---

## Alt kapsamlar

### `/secure full` (default)

Tam tarama. Şu kategoriler:

**1. Authentication & Authorization**
- JWT secret strong mı (env'den mi)
- Refresh token rotation var mı
- Expired token check doğru mu
- RBAC / role check her endpoint'te var mı
- Public endpoint'ler @Public() ile işaretli mi
- Password hashing algorithm güvenli mi (bcrypt/argon2)

**2. Input Validation**
- Her DTO'da class-validator decorator var mı
- Global ValidationPipe `whitelist: true, forbidNonWhitelisted: true` mi
- NoSQL injection: $where, $regex user input ile birlikte mi
- File upload: MIME + magic byte + size limit var mı

**3. Secrets & Config**
- Hardcoded secret var mı (grep)
- .env commit edilmiş mi (git log)
- .env.example'da sadece key'ler, value'lar yok mu
- CI/CD secret'ları hardcoded mı

**4. HTTP Security**
- Helmet kurulu ve config'li mi (CSP, HSTS)
- CORS origin whitelist mi, credentials doğru mu
- CSRF: SameSite cookie veya double-submit token var mı
- Body size limit var mı (express.json({ limit: '1mb' }))

**5. Rate Limiting**
- Global throttler var mı
- Login/signup/password-reset'te sıkı throttle var mı
- IP-based + user-based combine mi

**6. Error Handling**
- Stack trace production'da expose ediliyor mu
- Error mesajları PII içeriyor mu ("User X not found" gibi)
- 500'lerde detay log'a gidiyor mu, response'a değil

**7. Dependencies**
- `npm audit` kritik vulnerability var mı
- `snyk test` veya `trivy` çıktısı
- Outdated paketler (özellikle security fix'li)

**8. Logging & Monitoring**
- Sensitive data log'lanıyor mu (password, token redact)
- Failed login attempt'ler log'lanıyor mu (audit)
- Unusual pattern'ler için alerting var mı

### `/secure auth`
Sadece auth + authz flow (1. kategori).

### `/secure deps`
Sadece dependency vulnerabilities:
```bash
npm audit --audit-level=high
# veya
pnpm audit --audit-level=high
```

### `/secure secrets`
Sadece secret leak taraması:
```bash
# git history'de secret ara
git log --all -p | grep -iE "(password|secret|api.?key|token).*=.*['\"][A-Za-z0-9]{16,}"

# mevcut dosyalarda
grep -rE "(password|secret|api.?key).*=.*['\"][A-Za-z0-9]{16,}" src/
```

Ayrıca `gitleaks` kuruluysa:
```bash
gitleaks detect --source . --verbose
```

### `/secure headers`
Helmet config ve response header'ları:
```bash
# Gerçek response'u kontrol et
curl -I http://localhost:3000/health
# Beklenen: X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security, CSP
```

---

## Rapor formatı

security-dev agent aşağıdaki formatta döner:

```
SECURITY AUDIT: full

🔴 CRITICAL (2)
  [AUTH] src/modules/auth/auth.service.ts:45
    JWT_SECRET fallback value: 'dev-secret'
    → Env'de yoksa throw etmeli, fallback güvenlik açığı.

  [INPUT] src/modules/users/users.controller.ts:78
    User input direkt $regex'e geçiyor: { name: { $regex: req.query.q } }
    → Escape et veya whitelist regex pattern'i.

🟡 HIGH (3)
  [HEADERS] main.ts
    Helmet var ama CSP config edilmemiş.
    → app.use(helmet({ contentSecurityPolicy: { directives: {...} } }))

  [THROTTLE] src/modules/auth/auth.controller.ts
    /auth/login endpoint'inde @Throttle yok.
    → @Throttle(5, 60) — brute force önlemi.

  [DEPS] npm audit: axios@1.6.0 → CVE-2024-... (critical)
    → pnpm up axios@latest

🟠 MEDIUM (4)
  [LOGGING] src/modules/payments/payments.service.ts
    logger.info(`Payment processed for user ${user.email}`)
    → Email PII, log'tan redact et veya user.id kullan.

  [CORS] main.ts
    CORS origin: '*' — tüm origin'lere açık.
    → Whitelist: ['https://app.acme.com', 'https://admin.acme.com']
  ...

ℹ️ INFO (6)
  ...

ÖZET:
  🔴 2 critical — PRODUCTION'A GİTMEMELİ
  🟡 3 high — hızlı fix
  🟠 4 medium — bu sprint
  ℹ️ 6 info — tech debt

GENEL DURUM: CRITICAL ihlaller var, acil düzeltme gerekir.
```

---

## Öneri flow

```
Düzeltmeler için:
  /build auth-secret-fix       — JWT fallback'i kaldır
  /build login-throttle        — login endpoint'ine rate limit
  /build cors-whitelist        — CORS origin whitelist

veya manuel:
  cd && vim src/modules/auth/auth.service.ts  # ...
```

---

## YAPMA

- **Kod değiştirme.** Agent read-only (security-dev). Düzeltme ayrı bir /build.
- **False positive'leri CRITICAL yap.** Emin değilsen HIGH veya MEDIUM.
- **Production secret'ları log'la.** Audit raporunda bile `JWT_SECRET=***REDACTED***`.
- **Tek bir "genel bakış" raporu ver.** Her kategori ayrıntılı listelensin.
- **Network test yap** (gerçek host'a saldırı simülasyonu). Bu audit değil, pentest — ayrı iş.
