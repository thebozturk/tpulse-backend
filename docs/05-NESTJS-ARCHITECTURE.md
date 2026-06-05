# TransferPulse — Hedef NestJS Mimarisi (05)

> Bu doküman, taşıma sonrası NestJS projesinin **hedef yapısını** tanımlar: klasör düzeni, modüller, kavram eşlemeleri, kütüphane seçimleri ve ortak (cross-cutting) bileşenler.

## 1. Teknoloji Seçimleri

| Konu | Seçim | Not |
|---|---|---|
| Framework | **NestJS 10+** (Express adapter) | Fastify de olur; Express daha çok örnek |
| Dil | TypeScript (strict) | |
| ORM | **Prisma** | Tip güvenliği + migration ergonomisi; `prisma db pull` ile mevcut şemaya eşle |
| DB | PostgreSQL 16 | `pg_trgm` extension korunur |
| Auth | `@nestjs/passport` + `passport-jwt` + `@nestjs/jwt` | JWT + refresh rotation |
| Parola | `bcrypt` | work factor 12 |
| Google | `google-auth-library` | ID token verify |
| Cache/Redis | `ioredis` (+ `@nestjs/cache-manager`) | idempotency, cache-aside |
| Jobs | **`@nestjs/bullmq`** + `@nestjs/schedule` | Hangfire yerine BullMQ + cron |
| Storage | `@aws-sdk/client-s3` | R2 endpoint |
| Görsel | **`sharp`** | WebP dönüşümü |
| HTTP | `@nestjs/axios` | API-Football |
| Email | `nodemailer` / `@nestjs-modules/mailer` | SMTP |
| Validation | `class-validator` + `class-transformer` | global `ValidationPipe` |
| Rate limit | `@nestjs/throttler` | global/auth/write |
| Docs | `@nestjs/swagger` | |
| Telemetry | `@opentelemetry/sdk-node` | OTLP |
| Config | `@nestjs/config` + zod/Joi | env validation |
| Health | `@nestjs/terminus` | `/health` |

## 2. Klasör Yapısı

```
transferpulse-nest/
├─ prisma/
│  ├─ schema.prisma              # 01-DATA-MODEL.md'den
│  └─ migrations/
├─ src/
│  ├─ main.ts                    # bootstrap: ValidationPipe, CORS, Swagger, filters, /api prefix
│  ├─ app.module.ts              # tüm feature module'ları + global module'lar
│  │
│  ├─ common/                    # cross-cutting
│  │  ├─ prisma/                 # PrismaService (PrismaModule @Global)
│  │  ├─ redis/                  # RedisService (ioredis)
│  │  ├─ filters/                # HttpExceptionFilter (envelope), ValidationException→400
│  │  ├─ interceptors/           # IdempotencyInterceptor, (opsiyonel) ResponseEnvelope
│  │  ├─ guards/                 # JwtAuthGuard, RolesGuard, OptionalJwtGuard
│  │  ├─ decorators/             # @CurrentUser(), @Roles(), @Public()
│  │  ├─ dto/                    # PagedResult, response helper'ları
│  │  └─ pagination.ts
│  │
│  ├─ config/                    # @nestjs/config + zod schema; registerAs(jwt, redis, r2, apiFootball, email)
│  │
│  ├─ auth/                      # AuthModule: register/login/refresh/logout/google/şifre sıfırlama
│  │  ├─ auth.controller.ts      # api/auth
│  │  ├─ auth.service.ts
│  │  ├─ token.service.ts        # access + refresh üret
│  │  ├─ password.service.ts     # bcrypt + reset flow
│  │  ├─ jwt.strategy.ts
│  │  └─ dto/
│  │
│  ├─ users/                     # api/users (Admin) + ortak user erişimi
│  ├─ me/                        # api/me/* (favourites, notifications, notification-preferences, profile/photo)
│  │  ├─ favourites/  notifications/  notification-preferences/  profile-photo/
│  ├─ leagues/                   # api/leagues + api/admin/leagues + image
│  ├─ teams/                     # api/teams + api/admin/teams + image + team-transfers
│  ├─ players/                   # api/players + api/admin/players + image + player-transfers
│  ├─ transfers/                 # api/transfers (query/stats) + api/admin/transfers
│  ├─ rumours/                   # api/rumours
│  ├─ transfer-periods/          # api/admin/transfer-periods (+ public periods query)
│  ├─ news/                      # api/news + api/admin/news + image
│  ├─ posts/                     # api/posts + comments (post) — async/outbox
│  ├─ transfer-comments/         # api/transfers/{id}/comments + api/transfer-comments/*
│  ├─ search/                    # api/search (pg_trgm)
│  ├─ notifications/             # NotificationService (üretim) — me/ tarafından da kullanılır
│  │
│  ├─ storage/                   # StorageModule: R2StorageService, ImageService(sharp), ImageDownloader, ImageMirror
│  ├─ integration/
│  │  └─ api-football/           # FootballDataClient (axios), FootballDataSyncService, FootballDataSeeder
│  ├─ messaging/                 # OutboxModule: OutboxService, dispatcher cron, BullMQ processors, EventPublisher
│  └─ jobs/                      # BullMQ queue tanımları + worker bootstrap (ayrı process opsiyonu)
│
├─ test/
├─ docker-compose.yml
├─ Dockerfile
├─ .env.example
└─ package.json
```

> **Modül granülaritesi:** Her feature kendi `XxxModule`'una sahip; controller + service + DTO içerir. Admin controller'ları aynı modülde ayrı dosya (`admin-team.controller.ts`) olarak kalabilir. `image` controller'ları ilgili feature modülünde + `StorageModule` import.

## 3. Kavram Eşleme (referans)

| .NET | NestJS |
|---|---|
| `[ApiController]` + `[Route("api/x")]` | `@Controller('api/x')` |
| `[HttpGet("{id}")]` | `@Get(':id')` + `@Param('id', ParseUUIDPipe)` |
| `[FromQuery]`, `[FromBody]` | `@Query()`, `@Body()` |
| `[Authorize]` / `[Authorize(Roles="Admin")]` | `@UseGuards(JwtAuthGuard)` / `@UseGuards(JwtAuthGuard, RolesGuard) @Roles('Admin')` |
| `[AllowAnonymous]` | guard yok veya `@Public()` |
| `User.FindFirst(sub)` | `@CurrentUser()` decorator (request.user) |
| MediatR `Send(command)` | `service.method()` |
| `IRequestHandler` | service metodu |
| `AbstractValidator` (FluentValidation) | `class-validator` DTO + `ValidationPipe` |
| `Result<T>` / `PagedResult<T>` | TS interface + helper |
| `IServiceCollection.AddScoped` | `@Module({ providers: [...] })` |
| EF `DbContext` / `DbSet` | `PrismaService` |
| Repository sınıfı | Prisma tabanlı service/repo provider |
| `[EnableRateLimiting("write")]` | `@Throttle({ write: {...} })` / named throttler |
| Hangfire `RecurringJob` | `@Cron()` (`@nestjs/schedule`) |
| Hangfire job | BullMQ `@Processor` |
| Middleware | NestJS middleware / interceptor / guard |
| Exception filter | `@Catch()` `ExceptionFilter` |
| Swashbuckle | `@nestjs/swagger` decorators |

## 4. Cross-Cutting Bileşenler

### Response envelope (davranışı koru)
- Yazma/aksiyon: `{ success, message, data? }`. Sayfalama: `{ items, page, pageSize, totalCount, totalPages }`. Tekil: `{ data }`. Liste: `{ items }`.
- Mevcut controller'lar envelope'u **manuel** kurar → NestJS'te de elle kur (genel interceptor mevcut karışık şekilleri bozabilir; en güvenlisi her endpoint'te açık dönüş).

### Auth guard'ları
- `JwtAuthGuard` (zorunlu), `OptionalJwtGuard` (örn. `GET /api/posts` — auth varsa `isLiked`/favori filtresi, yoksa public).
- `RolesGuard` + `@Roles('Admin')` / `@Roles('Admin','Reporter')`.
- `@CurrentUser()` → `{ userId, email, username, role }`.

### Validation
- `app.useGlobalPipes(new ValidationPipe({ whitelist:true, forbidNonWhitelisted:false, transform:true, transformOptions:{ enableImplicitConversion:true } }))`.
- Query DTO'ları için `ParseUUIDPipe`, `ParseIntPipe`, default değerler (`@DefaultValuePipe` veya DTO default).

### Idempotency
- `IdempotencyInterceptor`: yazma method'larında `Idempotency-Key` header'ı varsa Redis `SET NX` (key `idem:{userId}:{path}:{key}`, TTL 10dk); duplicate ise cache'lenmiş yanıt/şart.

### Exception filter
- Global `@Catch()`: validation → 400 `{success:false,message,errors}`; bilinen domain hatları (NotFound/Forbidden/Conflict) → uygun status; diğeri → 500. Mevcut status code'ları (403/404/409/400) koru.

### Soft delete (Transfer)
- Prisma Client Extension veya repo helper: transfer/rumour okumalarında `where:{ isDeleted:false }`. Silme = `update({ isDeleted:true })`.

## 5. main.ts iskeleti (referans)

```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true,
    transformOptions: { enableImplicitConversion: true } }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableCors({ origin: config.cors.allowedOrigins, credentials: true });
  app.set('trust proxy', 1);
  // Swagger (EnableSwagger / dev)
  if (config.enableSwagger) setupSwagger(app);
  await app.listen(8080);
}
```
> Not: Mevcut route'lar zaten `api/...` ile başlıyor (controller'larda) — global prefix **ekleme** (çift `/api/api` olmasın). Controller'ları `@Controller('api/...')` ile tanımla.

## 6. Worker / Process Modeli
- **Tek process** (basit): API + BullMQ worker + cron aynı uygulamada. Başlangıç için yeterli.
- **İki process** (ölçek): `main.ts` (API) + `worker.ts` (BullMQ processor + cron). Aynı kod tabanı, `docker-compose`'da iki servis. Hangfire'ın mevcut "ayrı worker" modeline en yakını budur.
