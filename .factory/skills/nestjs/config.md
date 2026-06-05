---
name: nestjs-config
keywords: "config, ConfigModule, ConfigService, env, dotenv, validation, Joi"
description: "Environment variable yönetimi ve config validation"
---

# ConfigModule

## Setup

```typescript
// app.module.ts
import { ConfigModule } from '@nestjs/config';
import { envSchema } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],  // priority order
      validationSchema: envSchema,            // Joi ile zorunlu validation
      validationOptions: {
        abortEarly: false,
        allowUnknown: true,  // extra env var OK (CI'dan gelebilir)
      },
    }),
  ],
})
```

`isGlobal: true` ile her modülden erişilebilir.

## Joi validation schema

```typescript
// config/env.validation.ts
import * as Joi from 'joi';

export const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').required(),
  PORT: Joi.number().default(3000),

  // Database
  DATABASE_URL: Joi.string().uri().required(),
  DATABASE_POOL_SIZE: Joi.number().default(10),

  // JWT
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRY: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_EXPIRY: Joi.string().default('7d'),

  // Redis
  REDIS_URL: Joi.string().uri().required(),

  // Feature flags
  FILE_UPLOAD_ENABLED: Joi.boolean().default(false),

  // Conditional — sadece feature açıksa required
  AWS_S3_BUCKET: Joi.string().when('FILE_UPLOAD_ENABLED', {
    is: true,
    then: Joi.required(),
  }),
  AWS_ACCESS_KEY_ID: Joi.string().when('FILE_UPLOAD_ENABLED', { is: true, then: Joi.required() }),
  AWS_SECRET_ACCESS_KEY: Joi.string().when('FILE_UPLOAD_ENABLED', { is: true, then: Joi.required() }),

  // Bot defense (production'da zorunlu)
  CAPTCHA_SECRET: Joi.string().when('NODE_ENV', { is: 'production', then: Joi.required() }),
});
```

Geçersiz config → startup'ta throw (build fail).

## ConfigService kullanımı

### Sync (basic)
```typescript
@Injectable()
export class AppService {
  constructor(private readonly config: ConfigService) {}

  get port(): number {
    return this.config.get<number>('PORT', 3000);  // default 3000
  }

  get jwtSecret(): string {
    return this.config.getOrThrow<string>('JWT_SECRET');  // yoksa throw
  }
}
```

### Typed config (tercih)

`registerAs` ile namespace'lenmiş config:

```typescript
// config/database.config.ts
import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  url: process.env.DATABASE_URL,
  poolSize: parseInt(process.env.DATABASE_POOL_SIZE || '10', 10),
}));

// app.module.ts
ConfigModule.forRoot({
  isGlobal: true,
  load: [databaseConfig],
  validationSchema: envSchema,
})

// Kullanım
@Injectable()
export class DbService {
  constructor(private readonly config: ConfigService) {}

  get url(): string {
    return this.config.get<string>('database.url');
  }
}
```

### Strong typing

```typescript
// config/config.interface.ts
export interface AppConfig {
  database: {
    url: string;
    poolSize: number;
  };
  jwt: {
    secret: string;
    expiry: string;
  };
}

// Kullanım
@Injectable()
export class SomeService {
  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  method() {
    const url = this.config.getOrThrow('database.url');  // autocomplete
  }
}
```

## Async dependency (DB URL vs.)

```typescript
MongooseModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: async (config: ConfigService) => ({
    uri: config.getOrThrow<string>('DATABASE_URL'),
    serverSelectionTimeoutMS: 5000,
    maxPoolSize: config.get<number>('DATABASE_POOL_SIZE', 10),
  }),
}),
```

## Feature flags

```typescript
// config/features.config.ts
export default registerAs('features', () => ({
  fileUpload: process.env.FILE_UPLOAD_ENABLED === 'true',
  emailVerification: process.env.EMAIL_VERIFICATION === 'true',
}));

// Service'te
@Injectable()
export class UserService {
  constructor(private readonly config: ConfigService) {}

  async register(dto: RegisterDto) {
    const user = await this.create(dto);
    if (this.config.get('features.emailVerification')) {
      await this.sendVerificationEmail(user);
    }
    return user;
  }
}
```

## Production deployment

`.env` dosyası production'da commit'li değil. Kaynaklar:

1. **Docker Compose**: `environment:` section, secret manager ile dolar
2. **Kubernetes**: Secret + ConfigMap
3. **AWS**: SSM Parameter Store, Secrets Manager
4. **Vault**: HashiCorp Vault agent

```yaml
# k8s örnek
env:
  - name: DATABASE_URL
    valueFrom:
      secretKeyRef:
        name: backend-secrets
        key: database-url
```

## Anti-pattern'ler

### Default fallback secret
```typescript
// ❌ KÖTÜ — security-gate BLOCK
const secret = process.env.JWT_SECRET || 'dev-default-secret';
```

### Kod içinde hardcoded
```typescript
// ❌
const url = 'mongodb://localhost:27017/prod';
```

### Direct process.env everywhere
```typescript
// ❌ test'te mock zor
class Service {
  method() {
    const url = process.env.DATABASE_URL;  // inject et
  }
}
```

### Validation'sız config
```typescript
// ❌ NODE_ENV=typo bile geçer
ConfigModule.forRoot()  // no validationSchema
```

## Aksiyon

1. `envSchema` tanımla (Joi veya Zod)
2. `ConfigModule.forRoot({ isGlobal: true, validationSchema })`
3. Her service ConfigService inject eder
4. Typed namespace config (`registerAs`)
5. Critical secret için `getOrThrow`
6. `.env.example`'da tüm key'ler listeli
