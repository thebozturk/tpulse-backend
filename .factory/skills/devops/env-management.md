---
name: devops-env-management
keywords: "env, environment, staging, production, secret"
description: "Environment değişkenleri yönetimi"
---

# Environment Management

## Ortamlar

```
development  — local dev (`.env.local`)
test         — CI/CD test (in-memory)
staging      — pre-prod (vault)
production   — live (vault)
```

## Env dosya stratejisi

```
.env.example      → git commit (template, boş değerler)
.env              → git ignore, local dev default
.env.local        → git ignore, kişisel override
.env.production   → git ignore, prod (sadece pipeline'da inject)
```

## NODE_ENV

```typescript
// main.ts
const isProd = process.env.NODE_ENV === 'production';
if (isProd) {
  // Production-only: CSP sıkı, log JSON, Swagger disable
}
```

## Secret injection

### GitHub Actions
```yaml
env:
  DATABASE_URL: ${{ secrets.DATABASE_URL }}
  JWT_SECRET: ${{ secrets.JWT_SECRET }}
```

### K8s
```yaml
envFrom:
  - secretRef: { name: backend-secrets }
```

### Doppler / Vault CLI
```bash
doppler run -- node dist/main.js
```

Bkz. `security/secrets.md` detay.

## Aksiyon

- .env git'te değil, .env.example template
- NODE_ENV per ortam
- Secret prod'da vault
- Startup'ta validate (Joi)
