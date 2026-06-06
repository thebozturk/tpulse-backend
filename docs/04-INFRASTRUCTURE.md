# TransferPulse — Altyapı, Auth, Jobs & Konfigürasyon (04)

> Kaynak: `TransferPulse.Infrastructure/*`, `TransferPulse.Api/Program.cs` + Extensions/Middleware/Filters, `.env.example`, `appsettings*.json`, `docker-compose.yml`, `README.md`. Bu doküman dış servisleri ve startup pipeline'ını NestJS karşılıklarıyla anlatır.

> ⚠️ Aşağıdaki bazı sayısal default'lar (token süreleri, kalite, retry) koddan/dokümandan derlenmiştir. Taşıma sırasında ilgili `appsettings.json` / `Settings` sınıfından **kesin değeri teyit et**; mantık aynı kalmalı.

---

## 1. Authentication & Authorization

### JWT
- **Issuer:** `TransferPulse` · **Audience:** `TransferPulseApp`
- **Access token ömrü:** ~15 dk · **Refresh token ömrü:** ~90 gün
- **Algoritma:** HS256 (HMAC SHA-256), secret = `JWT_SECRET` env (**≥32 karakter**, validate edilir)
- **Validation:** issuer/audience/lifetime/signing key doğrulanır, `ClockSkew=0`
- **Claim'ler:** `sub`(userId), `email`, `unique_name`(username), `nickname`, `role`, `jti`

**NestJS:**
```typescript
// @nestjs/jwt + @nestjs/passport + passport-jwt
JwtModule.register({ secret: env.JWT_SECRET,
  signOptions: { issuer:'TransferPulse', audience:'TransferPulseApp', expiresIn:'15m', algorithm:'HS256' }})
// JwtStrategy.validate(payload) → { userId: payload.sub, email, username: payload.unique_name, role, ... }
// JwtAuthGuard (passport-jwt) + RolesGuard (@Roles('Admin') / @Roles('Admin','Reporter'))
```

### Parola Hash
- **BCrypt**, work factor **12**. → NestJS: `bcrypt` (`bcrypt.hash(pw,12)`, `bcrypt.compare`).

### Refresh Token (rotation)
- 64 rastgele byte → hex. `refresh` ucunda eskisi revoke + yeni üretilir (`ReplacedByToken`). `logout` tek token revoke; `revoke-all` kullanıcının tümünü revoke.

### Şifre sıfırlama akışı
- `forgot-password` → 32 byte token üret, **SHA-256 hash** DB'ye (`password_reset_token`), ham token **e-posta** ile. TTL ~60 dk (`Email:PasswordResetTokenMinutes`). Enumeration-safe (her zaman 200).
- `reset-password` → token hash eşleşir + süresi geçmemiş + kullanılmamış → parola güncelle, `UsedAt` set, **tüm refresh token'ları revoke**. Parola politikası: min 8 + upper/lower/digit.
- Email kapalıysa (`Email:Enabled=false`) reset linki **log'a** yazılır (akış yine çalışır).

### Google Auth
- `POST /api/auth/google` `{ idToken }` → Google ID token doğrula (`GOOGLE_AUTH_CLIENT_ID`), email ile kullanıcı bul; yoksa oluştur, varsa `GoogleId`'yi bağla. → NestJS: `google-auth-library` (`OAuth2Client.verifyIdToken`).

---

## 2. Caching & Idempotency (Redis)

- **Bağlantı:** `REDIS_CONNECTION_STRING` (default `localhost:6379`), opsiyonel `REDIS_READONLY_CONNECTION_STRING`. Instance prefix `tpulse:`.
- **Cache-aside:** `PostRepository`, `CommentRepository`, `NewsRepository` Redis'e cache yapar (README onaylı).
- **Idempotency:** `IdempotencyMiddleware` — yazma isteklerinde `Idempotency-Key` header'ı → Redis `SET NX` (key `Idempotency:{userId}:{path}:{key}`, TTL ~10 dk). Aynı key tekrar gelirse tekrar işlenmez.
- **Hangfire storage:** Redis (prefix `tpulse:hangfire:`).

**NestJS:** `ioredis` provider (+ opsiyonel `@nestjs/cache-manager` + `cache-manager-ioredis`). Idempotency = global interceptor/guard. BullMQ zaten Redis kullanır.

---

## 3. Storage (Cloudflare R2) & Görsel İşleme

- **R2 (S3 uyumlu):** `AWSSDK.S3`. Env: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`. `appsettings`: `CloudflareR2:BucketName`, `CloudflareR2:PublicBaseUrl` (CDN).
- **S3 config:** `ServiceURL = https://{accountId}.r2.cloudflarestorage.com`, `AuthenticationRegion="auto"`, `ForcePathStyle=true`, payload signing + checksum kapalı.
- **Klasörler:** `leagues/`, `teams/`, `players/`, profil. Dosya adı deterministik (re-sync'te yerinde ezilir, orphan yok). CDN URL = `{PublicBaseUrl}/{folder}/{fileName}`.
- **Görsel işleme (`SixLabors.ImageSharp`):** JPEG/PNG → WebP. Kalite: profil/news q80, takım/oyuncu q85, lig q90. İzin: `.jpg/.jpeg/.png/.webp`, max 5MB.
- **Image mirror:** API-Football görsellerini indir→WebP→R2'ye yükle; sadece **source URL değişince** yeniden mirror (`*SourceUrl` alanı). Admin yüklediyse (`*LockedByAdmin`) senkron ezmez.
- **Image downloader (SSRF korumalı):** public hostname doğrula (private/loopback IP bloke), izinli content-type, 10MB sınırı, redirect ≤3, timeout ~15s.

**NestJS:** `@aws-sdk/client-s3` (R2 endpoint) + **`sharp`** (WebP). Multipart için `@nestjs/platform-express` + `multer` (`FileInterceptor`).

---

## 4. Dış Entegrasyon: API-Football (api-sports.io)

- **Client:** HttpClient, base `https://v3.football.api-sports.io`. Header `x-apisports-key: {API_FOOTBALL_KEY}` (RapidAPI gateway için `x-rapidapi-key`/`x-rapidapi-host` desteği). Timeout ~30s, retry ~3 (429/5xx, exponential backoff).
- **Kullanılan uçlar:** `/leagues` (id,season), `/teams` (league,season), `/players` (team,season,page), `/transfers` (team).
- **Settings (`appsettings > ApiFootball`):** `LeagueIds` (örn. 39 PL, 78 Bundesliga, 140 LaLiga, 135 Serie A, 61 Ligue1, 203 ...), `Season`, `SyncCron`, `DetectTransfers`, `MirrorImagesToR2`.

### Senkron akışı (`FootballDataSyncService`)
1. Position cache yükle (isim→Position).
2. Her lig için: lig metadata fetch → League insert/update → takımlar (paginated) insert/update → her takım için oyuncular (paginated) insert/update.
3. **Oto-transfer tespiti** (opsiyonel): kadro değişince `/transfers` çek, doğru tarihli `Transfer` üret (`Source=ApiSports`).
4. **Free agent işaretleme:** senkronlanan liglerde hiçbir kadroda olmayan oyuncu → `IsFree=true` (asla hard-delete; Transfer/News/Post referansları korunur).
5. **Görsel mirror** (opsiyonel): lig logo / takım logo / oyuncu foto, sadece source URL değişince.
6. **Audit:** `SyncRun` kaydı (count'lar, status Success/Partial/Failed, süre).

### Seeder (`FootballDataSeeder`)
`leagues_with_players.json` (~268KB) → lig/takım/oyuncu bootstrap. **Idempotent** (ExternalId ile eşleşir), API key gerekmez. Pozisyonlar hardcoded EN/TR mapping.

**NestJS:** `@nestjs/axios` (retry: rxjs `retry`+`delay` veya interceptor). Cron: `@nestjs/schedule` `@Cron(env.SYNC_CRON)`. Uzun senkronu BullMQ job'una koy (tek tetikleyici cron → job).

---

## 5. Messaging — Outbox + Background Jobs (Hangfire → BullMQ)

### Outbox pattern
- `OutboxMessage` tablosu: `enqueue(eventType,payload)` ile DB'ye yazılır.
- **OutboxDispatcherJob** (Hangfire recurring, **her 1 dk**): `ProcessedAtUtc=null && RetryCount<10` mesajları çek (batch ~250), her birini worker job olarak kuyruğa al.
- **ReactionJobHandler** (idempotent — Redis lock `job:outbox:{messageId}`, TTL 10dk, retry 5):
  - `post.create` → Post oluştur · `comment.create` → Comment oluştur (parent post doğrula)
  - `post.reaction` / `comment.reaction` → like/unlike uygula, downstream event'ler publish: `counter.update`, `feed.fanout`, `realtime.notify`
  - Başarıda `ProcessedAtUtc` set; hatada `RetryCount++` + `LastError`.
- **ProjectionJobHandler** (retry 5): şimdilik placeholder (read-model/projeksiyon noktası).
- **HangfireEventPublisher** (`IEventPublisher`): event'i projection job olarak kuyruğa alır.

### Async kuyruğa alınan uçlar (davranışı koru — `202 Accepted`)
`POST /api/posts`, `POST /api/posts/{id}/like`, `DELETE .../like`, `POST /api/posts/{postId}/comments`, `POST /api/comments/{id}/like`, `DELETE .../like` → controller outbox'a yazar (202), iş job'da yapılır.

### Event payload'ları (`Application/DTOs/Integration`)
- `PostCreateEvent { userId, content, postType, isVotingEnabled, createdAtUtc, playerId?, fromTeamId?, toTeamId?, teamId? }`
- `CommentCreateEvent { userId, postId, content, parentId?, createdAtUtc }`
- `PostReactionEvent { postId, userId, isLike }`
- `CommentReactionEvent { commentId, userId, isLike }`

**NestJS:** **BullMQ** (`@nestjs/bullmq`). `outbox` queue + cron'la (her 1 dk) dispatcher → pending'leri queue'ya `add`. Worker = `@Processor('outbox')` (idempotency Redis lock, `attempts:5` + backoff). Notification job da ayrı queue olabilir.

> **Notification üretimi:** Rumour/transfer create/confirm sonrası `NotificationService.generateForTransfer(transferId)` çağrılır (controller sonrası fire-and-forget job olarak). Bunu BullMQ `notifications` queue'suna koy.

---

## 6. Email
- SMTP (`System.Net.Mail.SmtpClient`). `appsettings > Email`: `Enabled, Host, Port(587), UseSsl(true), Username, Password, FromAddress(no-reply@transferpulse.app), FromName(TransferPulse), PasswordResetUrlBase, PasswordResetTokenMinutes(60)`. Env: `SMTP_HOST/USERNAME/PASSWORD`.
- `Enabled=false` → e-posta log'a yazılır. HTML body destekli. Reset link: `{PasswordResetUrlBase}?email={enc}&token={raw}`.
- **NestJS:** `nodemailer` (`@nestjs-modules/mailer`), Handlebars/EJS template, opsiyonel BullMQ queue.

---

## 7. Startup Pipeline (Program.cs) — NestJS karşılıkları

DI/middleware sırası (mantığı koru):
1. **Env → config eşleme:** `Program.cs` bir sözlükle env'leri `appsettings` key'lerine map'ler (aşağıdaki tablo). → NestJS: `@nestjs/config` + `.env` + validation schema (Joi/zod).
2. **AddApplication / AddInfrastructure:** MediatR, FluentValidation, repository'ler, R2, ImageService, ImageDownloader, ApiFootballClient, ImageMirror, SyncService, FavouriteService, NotificationService, Email, Search, Redis, Idempotency, Outbox/event publisher, JWT/PasswordHasher. → NestJS: feature module'ları (bkz. 05).
3. **CORS:** `Cors:AllowedOrigins` (default `http://localhost:3000`), AnyHeader/AnyMethod, credentials. → `app.enableCors(...)`.
4. **Controllers + JSON:** `ReferenceHandler.IgnoreCycles`. → NestJS default JSON; circular ref'leri DTO ile düzleştir.
5. **Rate limiting:** global **300/dk/IP**; `auth` policy **30/dk/IP**; `write` policy **120/dk/user** (sliding window). → `@nestjs/throttler` (named throttlers + `@Throttle`).
6. **Health checks:** `/health` (PostgreSQL + Redis). → `@nestjs/terminus`.
7. **Hangfire** (Redis) + dashboard `/hangfire` (Admin guard). → BullMQ + opsiyonel Bull Board (admin korumalı).
8. **OpenTelemetry:** service `TransferPulse.Api`, trace+metrics, OTLP. → `@opentelemetry/sdk-node` + auto-instrumentations.
9. **Swagger** (`EnableSwagger` flag / dev). → `@nestjs/swagger` `/swagger`.
10. **DB migration:** `--migrate` flag veya `Database:RunMigrationsOnStartup=true`. → `prisma migrate deploy` (init container/CI önerilir).
11. **Forwarded headers** (X-Forwarded-For/Proto). → `app.set('trust proxy', ...)`.
12. **Middleware sırası:** ExceptionHandling → Idempotency → Swagger → HTTPS redirect → RateLimiter → CORS → Authentication → Authorization → Controllers → Health. → NestJS: global `ExceptionFilter`, idempotency interceptor, throttler guard, `JwtAuthGuard`+`RolesGuard`.
13. **Recurring jobs:** `outbox-dispatcher` (her 1 dk), `football-data-sync` (`SyncCron`). → `@nestjs/schedule` `@Cron`.

### Filters/Middleware (Api katmanı)
- **ExceptionHandlingMiddleware:** `ValidationException`→400 (`{success:false,message,errors}`), genel→500. → global `HttpExceptionFilter`.
- **IdempotencyMiddleware:** yukarı bak. **HangfireAuthorizationFilter:** dashboard Admin-only.

---

## 8. Konfigürasyon & Environment Değişkenleri

### Env (kaynak: `.env.example` + README — kesin)
| Env | Zorunlu | Açıklama |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL bağlantı string'i (`Host=...;Port=5432;Database=...;Username=...;Password=...`) |
| `JWT_SECRET` | ✅ | Token imzalama, **≥32 karakter** |
| `REDIS_CONNECTION_STRING` | ✅ | Hangfire + idempotency + cache (`localhost:6379`) |
| `REDIS_READONLY_CONNECTION_STRING` | ➖ | Redis read-replica |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | görseller için | Cloudflare R2 |
| `GOOGLE_AUTH_CLIENT_ID` | Google login için | OAuth client id |
| `API_FOOTBALL_KEY` | senkron için | api-football.com ücretli plan (boşsa senkron pasif) |
| `SMTP_HOST` / `SMTP_USERNAME` / `SMTP_PASSWORD` | opsiyonel | reset e-postası; boşsa link log'a |

> Env'de **olmayan** ayarlar `appsettings.json` altında: `CloudflareR2:BucketName/PublicBaseUrl`, `ApiFootball:LeagueIds/Season/SyncCron`, `Email:Enabled/PasswordResetUrlBase`, `JwtSettings:Issuer/Audience/Expiration`, `Redis:InstanceName`, `Cors:AllowedOrigins`, `Hangfire:Enabled`, `EnableSwagger`.

> **NestJS env önerisi:** `.env`'i `@nestjs/config` ile yükle, zod/Joi ile validate et (eksikse process açılmaz). `DATABASE_URL`'i Prisma formatına çevir: `postgresql://user:pass@host:5432/db`.

### .NET → appsettings key eşlemesi (Program.cs sözlüğü)
```
DATABASE_URL                     → ConnectionStrings:DefaultConnection
JWT_SECRET                       → JwtSettings:Secret
REDIS_CONNECTION_STRING          → Redis:ConnectionString
REDIS_READONLY_CONNECTION_STRING → Redis:ReadOnlyConnectionString
R2_ACCOUNT_ID                    → CloudflareR2:AccountId
R2_ACCESS_KEY_ID                 → CloudflareR2:AccessKeyId
R2_SECRET_ACCESS_KEY             → CloudflareR2:SecretAccessKey
GOOGLE_AUTH_CLIENT_ID            → GoogleAuth:ClientId
API_FOOTBALL_KEY                 → ApiFootball:ApiKey
SMTP_HOST / SMTP_USERNAME / SMTP_PASSWORD → Email:Host / Email:Username / Email:Password
```

### docker-compose (dev)
```yaml
postgres: postgres:16-alpine  # DB=transferpulse USER=tpulse PASS=tpulse_dev, 5432
redis:    redis:7-alpine      # --appendonly yes, 6379
api:      build .             # profile [full], DATABASE_URL/REDIS/JWT_SECRET env'leri
```

**NestJS docker-compose:** aynı postgres + redis servisleri korunur; `api` servisini Node imajına çevir (`node:20-alpine`, `prisma migrate deploy && node dist/main.js`). İstersen ayrı bir `worker` servisi (BullMQ processor + cron) ekle.

---

## 9. Henüz aktif olmayan (taşımada opsiyonel)
- **Push (FCM/APNs)** — platform kararı bekliyor (in-app bildirim çalışıyor).
- **Facebook / Apple login** — credential bekliyor (Google hazır).
- **Elasticsearch** — şimdilik arama pg_trgm ile. `ISearchService` soyutlaması korunmalı.
