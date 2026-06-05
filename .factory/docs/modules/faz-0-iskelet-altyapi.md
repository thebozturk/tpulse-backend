# faz-0-iskelet-altyapi

> TransferPulse .NET → NestJS taşımasının ilk fazı. Kaynak: `docs/06-MIGRATION-ROADMAP.md` (Faz 0), `docs/04-INFRASTRUCTURE.md`, `docs/05-NESTJS-ARCHITECTURE.md`.

## Amaç

Boş ama `docker compose up` ile ayağa kalkan NestJS uygulaması: env validation, Prisma + Redis bağlantısı, cross-cutting iskelet (filter/guard/decorator/pagination), `/health` ve Swagger. İş kodu yok — sadece altyapı.

## Alınan teknik kararlar

- **DB yaklaşımı:** Greenfield. `docs/01-DATA-MODEL.md`'den `schema.prisma`, sıfırdan migration, seed ile doldurulur. `prisma db pull` YOK (mevcut DB kullanılmıyor).
- **Process modeli:** Tek process (API + worker + cron aynı uygulamada). Messaging/jobs modülleri process-agnostic kurulur ki ileride `worker.ts` ayrımı ücretsiz olsun.
- **Env validation:** Zod (`@nestjs/config` + zod schema). Eksik/invalid env → boot'ta throw.
- **TypeScript strict:** Şimdilik KAPALI (scaffold default — bkz. conventions.json).
- **Global prefix:** EKLENMEZ. Controller route'ları zaten `api/...` ile başlar (çift `/api/api` olmasın).
- **Port:** `PORT` env, default **8080** (docs/05 main.ts ile tutarlı).

## Dosya yapısı

```
prisma/
└─ schema.prisma              # datasource(postgresql) + generator(prisma-client-js) — MODELLER FAZ 1
src/
├─ main.ts                    # bootstrap pipeline (aşağıda)
├─ app.module.ts             # ConfigModule + PrismaModule + RedisModule + ThrottlerModule + HealthModule
├─ config/
│  ├─ env.validation.ts       # zod schema (eksikse throw, abortEarly:false)
│  ├─ configuration.ts        # registerAs namespace'ler: app, database, jwt, redis, cors, swagger
│  └─ config.module.ts        # ConfigModule.forRoot({ isGlobal, validate })  (veya app.module'da)
├─ common/
│  ├─ prisma/
│  │  ├─ prisma.module.ts      # @Global
│  │  └─ prisma.service.ts     # extends PrismaClient; onModuleInit connect; enableShutdownHooks
│  ├─ redis/
│  │  ├─ redis.module.ts       # @Global
│  │  └─ redis.service.ts      # ioredis (keyPrefix 'tpulse:'); onModuleDestroy quit
│  ├─ filters/
│  │  └─ http-exception.filter.ts   # envelope { success:false, message, errors? }; 400/401/403/404/409 korunur
│  ├─ guards/
│  │  ├─ jwt-auth.guard.ts     # passport-jwt tabanlı İSKELET; @Public bypass (gerçek strateji Faz 2)
│  │  └─ roles.guard.ts        # @Roles metadata okur (Reflector)
│  ├─ decorators/
│  │  ├─ public.decorator.ts   # @Public() → IS_PUBLIC_KEY
│  │  ├─ roles.decorator.ts    # @Roles(...roles)
│  │  └─ current-user.decorator.ts  # @CurrentUser() → request.user
│  ├─ dto/
│  │  └─ pagination-query.dto.ts    # page=1, pageSize=20 (≤100 clamp), class-validator
│  ├─ interfaces/
│  │  └─ response.interface.ts # ApiResponse / PagedResult<T> tipleri
│  └─ pagination.ts            # buildPaged(items, totalCount, page, pageSize): PagedResult<T>
└─ health/
   ├─ health.module.ts
   └─ health.controller.ts     # @Public GET /health — terminus: Prisma ping + Redis ping
docker-compose.yml             # postgres:16-alpine + redis:7-alpine + api
Dockerfile                     # multi-stage (.claude/rules/docker.md)
.dockerignore
.env.example
```

## main.ts bootstrap pipeline

```
const app = await NestFactory.create(AppModule);
app.useGlobalPipes(new ValidationPipe({ whitelist:true, transform:true,
  transformOptions:{ enableImplicitConversion:true } }));
app.useGlobalFilters(new HttpExceptionFilter());
app.enableCors({ origin: config.cors.allowedOrigins, credentials:true });
app.set('trust proxy', 1);
if (config.swagger.enabled) setupSwagger(app);   // /swagger
await app.listen(config.app.port);               // GLOBAL PREFIX YOK
```

## app.module.ts

- `ConfigModule.forRoot({ isGlobal:true, validate: validateEnv, load:[configuration] })`
- `ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }])` (global 300/dk) + `APP_GUARD` ThrottlerGuard
- `PrismaModule` (@Global), `RedisModule` (@Global), `HealthModule`

## Response envelope (filter çıktısı)

Hata: `{ success:false, message, errors? }`. Mevcut status code'lar (400/401/403/404/409/500) korunur. Başarı envelope'u (`{success,message,data}` / paged) endpoint'lerde elle kurulacak (Faz 2+).

## Paketler

Eklenecek (runtime): `@nestjs/config zod @prisma/client ioredis @nestjs/passport passport passport-jwt @nestjs/jwt @nestjs/throttler @nestjs/terminus @nestjs/swagger`
Eklenecek (dev): `prisma @types/passport-jwt`

> **Ertelendi (Faz 0 kapsamı dışı):** `@nestjs/bullmq bullmq` → Faz 5. `@nestjs/schedule` → Faz 7. `bcrypt google-auth-library nodemailer @aws-sdk/client-s3 sharp @nestjs/axios` → ilgili fazlar. Faz 0 doğrulaması bunları gerektirmez.

## Env (.env.example)

```
NODE_ENV=development
PORT=8080
DATABASE_URL=postgresql://tpulse:tpulse_dev@localhost:5432/transferpulse
JWT_SECRET=                      # ≥32 karakter (kullanıcı doldurur)
REDIS_CONNECTION_STRING=redis://localhost:6379
CORS_ALLOWED_ORIGINS=http://localhost:3000
ENABLE_SWAGGER=true
# --- ileride dolacak placeholder'lar ---
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
GOOGLE_AUTH_CLIENT_ID=
API_FOOTBALL_KEY=
SMTP_HOST=
SMTP_USERNAME=
SMTP_PASSWORD=
```

zod schema: `DATABASE_URL` url, `JWT_SECRET` min 32, `PORT` coerce number default 8080, `NODE_ENV` enum, `REDIS_CONNECTION_STRING` zorunlu. R2/Google/API-Football/SMTP opsiyonel (Faz 0'da boş olabilir).

## docker-compose.yml

- `postgres:16-alpine` — DB `transferpulse`, USER `tpulse`, PASS `tpulse_dev`, 5432, healthcheck `pg_isready`.
- `redis:7-alpine` — `--appendonly yes`, 6379, healthcheck `redis-cli ping`.
- `api` — build ., `node:20-alpine`, depends_on (healthy), `prisma migrate deploy && node dist/main.js`, env'ler compose'tan, healthcheck `/health`.

## Kurallar

- `.env` commit edilmez (.gitignore'da mevcut). `.env.example`'da gerçek secret YOK.
- Hardcoded secret yok — ConfigService üzerinden oku.
- Logger inject (no console.log).
- Guard'lar single-responsibility (JwtAuthGuard ≠ RolesGuard).

## Test (Faz 0 minimum)

- `health.controller.spec.ts` — `/health` 200 döner (terminus mock).
- `pagination.spec.ts` — `buildPaged` totalPages/hasNext/hasPrevious hesabı.
- (Boot smoke) `app.e2e-spec.ts` güncelle: `/health` 200.

## Doğrulama kriteri (docs/06 — Faz 0 çıkışı)

- [ ] `docker compose up` → app ayağa kalkar.
- [ ] `GET /health` 200 (postgres + redis up).
- [ ] `/swagger` erişilebilir (ENABLE_SWAGGER=true).
- [ ] Eksik/invalid env'de uygulama **açılmaz** (zod throw).
- [ ] `pnpm tsc --noEmit` + `pnpm lint` temiz.

## Build sırası

1. Paketleri ekle + `prisma init` (datasource/generator) + `prisma generate`.
2. config (zod env validation + namespaces).
3. common/prisma + common/redis.
4. common/filters + guards + decorators + dto + pagination.
5. health modülü.
6. main.ts + app.module.ts wiring.
7. Dockerfile + docker-compose + .env.example + .dockerignore.
8. Test + `tsc --noEmit` + lint.

## Sonraki faz

Faz 1 — Veri Modeli (Prisma): `docs/01-DATA-MODEL.md`'den tam `schema.prisma`, enum saklama biçimi (smallint→Int), soft-delete helper, ilk migration.
