---
globs: "src/config/**,**/*.env*,src/**/config.ts"
severity: must
---

# Config & Env Kuralları

`src/config/**`, `.env*`, `src/**/config.ts` dosyalarında aktif.

## MUST

- Her env variable **ZORUNLU** olarak `.env.example`'a girer (placeholder ile)
- Kod sadece `ConfigService` veya doğrudan `process.env.X` üzerinden okur
- Kritik config (DB URL, JWT_SECRET) startup'ta validate edilir — yoksa throw
- `.env` git'e commit edilmez (.gitignore'da)
- Default değer ile fallback **YASAK** kritik secret'lar için (`dev-secret` gibi)
- Production config validation `@nestjs/config` ile Joi/Zod schema

## SHOULD

- Config'i group'la: `database`, `jwt`, `redis`, `aws` gibi namespace
- ConfigService'i inject et, global değil
- Production ≠ dev değerleri: `.env.example`'da sadece key'ler var, `.env` local, `.env.production` CI'dan gelir

## ASLA

- `.env` dosyasını commit etme
- Production secret'ı `.env.example`'a koy
- `process.env.X || 'default-secret'` pattern (security-gate BLOCK)
- Kod içinde hardcoded database URL / API key
- Config'i startup dışında değiştir (runtime mutation)
- Feature flag'ları `.env`'e gömme (bunu ayrı feature flag sistemi veya DB)

## Örnekler

### İyi — validation schema
```typescript
// src/config/env.validation.ts
import * as Joi from 'joi';

export const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').required(),
  PORT: Joi.number().default(3000),
  DATABASE_URL: Joi.string().uri().required(),
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRY: Joi.string().default('15m'),
  REDIS_URL: Joi.string().uri().required(),

  AWS_REGION: Joi.string().when('FILE_UPLOAD_ENABLED', { is: 'true', then: Joi.required() }),
  AWS_S3_BUCKET: Joi.string().when('FILE_UPLOAD_ENABLED', { is: 'true', then: Joi.required() }),
});
```

### İyi — ConfigModule setup
```typescript
// app.module.ts
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validationSchema: envSchema,
      validationOptions: { abortEarly: false },
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        uri: cfg.getOrThrow<string>('DATABASE_URL'),
      }),
    }),
  ],
})
```

### İyi — ConfigService kullanımı
```typescript
@Injectable()
export class AuthService {
  constructor(private readonly config: ConfigService) {}

  private get jwtSecret(): string {
    return this.config.getOrThrow<string>('JWT_SECRET');
  }

  private get jwtExpiry(): string {
    return this.config.get<string>('JWT_EXPIRY', '15m');
  }
}
```

### İyi — `.env.example`
```env
# Environment
NODE_ENV=development

# Server
PORT=3000

# Database (MongoDB replica set for transactions)
DATABASE_URL=mongodb://localhost:27017/acme?replicaSet=rs0

# JWT
JWT_SECRET=                   # ← kullanıcı doldurur (minimum 32 char)
JWT_EXPIRY=15m
JWT_REFRESH_SECRET=
JWT_REFRESH_EXPIRY=7d

# Redis
REDIS_URL=redis://localhost:6379

# AWS (opsiyonel — FILE_UPLOAD_ENABLED=true ise zorunlu)
FILE_UPLOAD_ENABLED=false
AWS_REGION=
AWS_S3_BUCKET=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# Bot defense
CAPTCHA_SECRET=
CAPTCHA_SITE_KEY=
```

### Kötü
```typescript
// ❌ Hardcoded secret
const JWT_SECRET = 'my-super-secret-key-123';

// ❌ Fallback secret
const secret = process.env.JWT_SECRET || 'dev-secret-fallback';

// ❌ Runtime değişiklik
process.env.DATABASE_URL = newUrl;

// ❌ Direct process.env everywhere (inject et)
export class Service {
  async method() {
    const url = process.env.DATABASE_URL;  // ConfigService üzerinden git
  }
}
```

```env
# Kötü .env.example
JWT_SECRET=my-actual-prod-secret-123   # ❌ gerçek value
DATABASE_URL=mongodb://prod:pw@host    # ❌ gerçek kredansiyel
```

## Security-gate etkileşimi

- `.env` dosyasına yazma → BLOCK
- Hardcoded secret → BLOCK (pattern match)
- `|| 'fallback-secret'` → BLOCK
- `.env.example`'da uzun random-görünümlü string → uyarı (unut mu edilmiş?)

## Dev vs Prod

| Değer | Dev (.env) | Prod |
|-------|------------|------|
| NODE_ENV | development | production |
| DATABASE_URL | localhost | managed DB URI |
| JWT_SECRET | random 32+ char | vault'tan |
| JWT_EXPIRY | 15m veya 1h | 15m (kısa) |
| LOG_LEVEL | debug | info |

Production config'e CI/CD ortamında secret manager'dan inject edilir (AWS SSM, Vault, Doppler).
