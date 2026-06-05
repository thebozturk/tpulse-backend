---
name: config-management
keywords: "config, env, environment, validation, fail-fast, secrets, sanitization"
description: "Configuration management — env vs constants vs FF, validation, sanitization"
---

# Configuration Management

## Üç ayrı kavram

| Tip | Değişir mi? | Hassas mı? | Nerede yaşar? |
|-----|------------|------------|---------------|
| **Environment variables** | Çevreye göre | Çoğu zaman | `.env` / secret manager |
| **Constants** | Hayır (sabit) | Hayır | Kod içinde |
| **Feature Flags** | Runtime | Hayır | env'den okunur, FF service yönetir |

Bu üçü ayrı tutmak, her birinin **doğru yerde** olmasını sağlar.

## 1. Environment Variables

**Çevreye göre değişen, hassas olabilen değerler.**

```bash
# .env (gitignore'da)
DATABASE_URL=postgresql://user:pass@localhost:5432/app_dev
JWT_SECRET=local-dev-secret-min-16-char
OPENAI_API_KEY=sk-proj-abc123...
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug
```

```bash
# .env.example (repo'da, placeholder'larla)
DATABASE_URL=postgresql://user:pass@host:5432/db
JWT_SECRET=change-me-min-16-chars
OPENAI_API_KEY=sk-proj-...
NODE_ENV=development
PORT=3000
LOG_LEVEL=info
```

## 2. Constants

**Çevreye göre değişmeyen sabit değerler.**

```typescript
// constants.ts
export const API_PREFIX = "/api";
export const MAX_REQUEST_SIZE = "10mb";
export const HEADER_CLIENT_TYPE = "x-client-type";
export const HEADER_APP_CHECK = "x-firebase-appcheck";
export const SESSION_COOKIE_NAME = "session_id";
export const REFRESH_TOKEN_COOKIE = "refresh_token";

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  // ...
} as const;
```

Kod içinde tanımlanır, env'e gerek yok.

## 3. Feature Flags

Bkz. `feature-flags.md` — env'den okunur ama sıradan env değil. Hot reload + override + type-safe access.

## Env validation — fail-fast

Env'den okunan ham string'ler **boolean veya number'a çevrilmeli ve valide edilmeli**.

```typescript
// config/env.ts
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  DATABASE_URL: z.string().url().startsWith("postgresql://"),

  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  JWT_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),

  OPENAI_API_KEY: z.string().startsWith("sk-").optional(),

  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  REDIS_URL: z.string().url().optional(),

  FRONTEND_URL: z.string().url(),

  // Feature flag defaults (FeatureFlagService da okuyacak ama burada coerce)
  STREAMING_ENABLED: z.coerce.boolean().default(false),
  PAGINATION_LIMIT: z.coerce.number().int().min(10).max(100).default(20),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("❌ Invalid environment variables:");
    console.error(JSON.stringify(result.error.flatten().fieldErrors, null, 2));
    process.exit(1);                                // ← FAIL FAST
  }
  return result.data;
}

export const env = loadEnv();
```

Validation başarısızsa **uygulama açılışta patlar** — net hata mesajı.

**"Yanlış config'le başlamış sistem" durumu engellenir.** "Sessizce çalışıyor ama yanlış davranıyor" yerine "açılmıyor" tercih edilir.

## .env vs .env.example disiplini

```bash
# .gitignore — KESİNLİKLE
.env
.env.local
.env.production
.env.*.local

# istisna
!.env.example
```

`.env` — geliştiricinin yerel makinesindeki gerçek değerler. **Git'e commit edilmez.**

`.env.example` — hangi değişkenlerin gerekli olduğunu gösterir. Repo'da bulunur. Yeni geliştirici kopyalar, kendi değerlerini doldurur.

## Sensitive data sanitization (logger)

JWT secret, OPENAI_API_KEY gibi değerler log'lara düşmemeli.

```typescript
// logger/sanitize.ts
const SENSITIVE_KEYS = [
  "password",
  "passwordHash",
  "token",
  "accessToken",
  "refreshToken",
  "authorization",
  "apiKey",
  "api_key",
  "secret",
  "jwt",
  "openai_api_key",
  "stripe_secret",
  "x-api-key",
];

export function sanitize(obj: unknown): unknown {
  if (typeof obj !== "object" || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(sanitize);

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const lower = key.toLowerCase();
    if (SENSITIVE_KEYS.some(s => lower.includes(s))) {
      result[key] = "[REDACTED]";
    } else if (typeof value === "object") {
      result[key] = sanitize(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}
```

```typescript
// Logger setup
import pino from "pino";

const logger = pino({
  level: env.LOG_LEVEL,
  formatters: {
    log(obj) {
      return sanitize(obj) as object;
    },
  },
});

logger.info({ user: { id: "u1", password: "secret123" } }, "test");
// {"user":{"id":"u1","password":"[REDACTED]"},"msg":"test"}
```

`pino` redact native:
```typescript
const logger = pino({
  redact: {
    paths: ["password", "*.password", "token", "*.token", "authorization"],
    censor: "[REDACTED]",
  },
});
```

## Production secret manager

Production'da `.env` yerine secret manager:

```typescript
// Production örneği — AWS Secrets Manager
import { SecretsManager } from "@aws-sdk/client-secrets-manager";

async function loadSecretsFromAWS() {
  const client = new SecretsManager({ region: "eu-central-1" });
  const secret = await client.getSecretValue({ SecretId: "prod/app/secrets" });
  return JSON.parse(secret.SecretString!);
}

if (env.NODE_ENV === "production") {
  const secrets = await loadSecretsFromAWS();
  process.env.JWT_SECRET = secrets.JWT_SECRET;
  process.env.DATABASE_URL = secrets.DATABASE_URL;
  process.env.OPENAI_API_KEY = secrets.OPENAI_API_KEY;
}

// Sonra normal env validation
export const env = loadEnv();
```

GCP: `Secret Manager`. Azure: `Key Vault`. Vercel/Netlify: built-in env UI.

## docker-compose env

```yaml
# docker-compose.yml
services:
  app:
    image: my-app
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - JWT_SECRET=${JWT_SECRET}
    env_file:
      - .env.production         # ← gitignore'da
```

Compose env precedence: env_file < environment < shell.

## Config DI (dependency injection)

```typescript
// service'ler env'i import etmek yerine constructor'dan alabilir
class JwtService {
  constructor(
    private secret: string,
    private expiresIn: string,
  ) {}

  sign(payload: object) {
    return jwt.sign(payload, this.secret, { expiresIn: this.expiresIn });
  }
}

// DI container
const jwtService = new JwtService(env.JWT_SECRET, env.JWT_EXPIRES_IN);
```

Test'te farklı secret ile mock kolay.

## Yapma

- `process.env.X` her dosyada direkt okumak (typed `env` import et)
- Coercion atlamak (`PORT=3000` string olarak gelir, `Number(env.PORT)` her yerde — coerce schema'da)
- `.env` commit'lemek (.gitignore'da olmalı)
- Validation'sız boot — fail-fast olmadan "yanlış config çalışıyor"
- Sensitive field'ı `console.log(req.body)` ile yazmak (`req.body.password` log'da)
- Production'da `.env` dosyası kullanmak (secret manager)
- Constants'ı env'e koymak (`API_PREFIX=/api` env'de değil constants'ta)
- Feature flag'i constants'a koymak (FF service'i kullan)
- Hassas key'i FF olarak yapmak (FF runtime'da değişmemeli güvenlik için)

## Aksiyon

1. `config/env.ts` — zod schema + fail-fast `parse()`
2. Tüm process.env okumalar typed `env` üzerinden
3. `.gitignore`'da `.env*` (`.env.example` istisna)
4. `.env.example` placeholder'larla repo'da
5. Logger redact (password, token, secret, apiKey)
6. JWT_SECRET min 16 char (zod validate)
7. Production'da secret manager (AWS/GCP/Azure)
8. Constants kod içinde, FF servisi ayrı
9. Service'ler env'i constructor'dan alabilir (test mock kolay)
