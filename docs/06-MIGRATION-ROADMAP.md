# TransferPulse — Faz Faz Taşıma Yol Haritası (06)

> Her faz **çalışır/derlenebilir** bir durum bırakmalı. AI ile çalışırken her fazı ayrı görev olarak ver; faz sonunda doğrulama kriterlerini kontrol et. Önerilen ORM: Prisma.

---

## Faz 0 — İskelet & Altyapı
**Hedef:** Boş ama ayağa kalkan NestJS uygulaması.
- Nest projesi (`nest new`), strict tsconfig, ESLint/Prettier.
- `@nestjs/config` + zod env validation (`04` env listesi). Eksik env'de açılmasın.
- `PrismaModule` (@Global) + `PrismaService`; `RedisModule` (ioredis).
- `common/`: `HttpExceptionFilter` (envelope), `JwtAuthGuard`/`RolesGuard` iskeleti, `@CurrentUser`/`@Roles` decorator'ları, `ValidationPipe` global, `pagination` helper.
- `docker-compose.yml`: postgres:16 + redis:7 (mevcut compose'tan kopyala), `api` Node servisi.
- `/health` (terminus: db+redis), Swagger (flag'li), CORS, throttler global (300/dk).

**Doğrulama:** `docker compose up` → app açılır, `/health` 200, `/swagger` görünür.

## Faz 1 — Veri Modeli (Prisma)
**Hedef:** Şema mevcut DB ile birebir.
- `01-DATA-MODEL.md`'den `schema.prisma`. Mümkünse **mevcut DB'ye `prisma db pull`** → dokümanla karşılaştır → enum saklama (string/short), index/unique, `@map` kolon adlarını düzelt.
- `pg_trgm` extension migration'da. Soft-delete helper (Transfer).
- Enum eşlemeleri (`PostType`, `PostVoteChoice`, `FavouriteType`, `NotificationEventType`, `SyncRunStatus` = Int; `UserStatus`, `TransferSource` = native enum/string).

**Doğrulama:** `prisma generate` + `prisma migrate status` temiz; mevcut veriye bağlanıp birkaç tablo okunuyor (read smoke).

## Faz 2 — Auth & Users
**Hedef:** Kimlik akışı tam.
- `AuthModule`: register/login/refresh/logout/revoke-all/forgot-password/reset-password/google. JWT (issuer/audience/15dk, claim'ler), refresh rotation, bcrypt(12), şifre sıfırlama (SHA-256 token, email veya log), Google ID token verify.
- `UsersModule` (Admin CRUD + paged). Validation kuralları (`03`).
- `JwtAuthGuard` + `RolesGuard` gerçek implementasyon. Throttler `auth` policy (30/dk).

**Doğrulama:** register→login→refresh→logout→revoke-all çalışır; JWT claim'leri aynı; Admin guard 403 veriyor; parola politikası 400.

## Faz 3 — Katalog (okuma) + Search
**Hedef:** Public okuma uçları.
- `leagues`, `teams` (+ detail), `players` (+ profile, search, free-agents, by-*), `transfers` (query/stats/periods/dashboard), `rumours` (okuma), `news` (okuma), `team-transfers`, `player-transfers`.
- `SearchModule`: pg_trgm fuzzy (`/api/search`, `/api/players/search`).
- Tüm sayfalama/filtre/sort davranışı + DTO şekilleri **birebir** (`02`/`03`).

**Doğrulama:** Mevcut DB ile GET uçları aynı JSON'u döndürüyor (eski backend ile diff).

## Faz 4 — Storage & Görsel + Admin CRUD
**Hedef:** Admin yönetim + görseller.
- `StorageModule`: R2 (`@aws-sdk/client-s3`), `sharp` WebP, downloader (SSRF korumalı), mirror.
- Admin CRUD: leagues/teams/players/news/transfers/transfer-periods (409/404/400 davranışları).
- Görsel controller'ları (league/team/player/news/profile): POST/PUT/from-url/DELETE, `*LockedByAdmin` flag, kalite ayarları.

**Doğrulama:** Görsel yükleme → R2'ye WebP, CDN URL döner; admin CRUD doğru status code'lar; lock flag set/reset.

## Faz 5 — Sosyal (Post/Comment) + Messaging
**Hedef:** Async write path + outbox.
- `messaging`: `OutboxService`, BullMQ `outbox` queue, dispatcher cron (her 1 dk), `ReactionJobHandler` (idempotent, retry 5), event publisher.
- `posts` + post `comments` + `transfer-comments`. **Async uçlar 202** (post create, post/comment like/unlike, post comment create) → outbox; transfer-comment like senkron.
- Oylama (VoteMath birebir), favori-filtreli feed, like-state hidrasyonu.

**Doğrulama:** Post oluştur → 202 → job işler → DB'de görünür; like/unlike idempotent; oy yüzdeleri aynı.

## Faz 6 — Favoriler & Bildirimler
**Hedef:** Kişiselleştirme + in-app bildirim.
- `me/favourites` (get/add/remove/set), `FavouriteService` (target çözümleme, lig→takım genişletme).
- `NotificationService.generateForTransfer` (dedup + opt-out) — rumour/transfer create/confirm sonrası BullMQ `notifications` job'ı.
- `me/notifications` (+ unread-count, read, read-all), `me/notification-preferences`.

**Doğrulama:** Favori ekle → eşleşen rumour oluştur → bildirim üretiliyor (dedup çalışıyor); opt-out edilen tip gelmiyor.

## Faz 7 — API-Football Senkron & Seed
**Hedef:** Veri besleme.
- `integration/api-football`: `FootballDataClient` (axios + retry), `FootballDataSyncService` (lig/takım/oyuncu insert-update, oto-transfer, free-agent, görsel mirror, `SyncRun` audit), `FootballDataSeeder` (`leagues_with_players.json`).
- `admin/sync` (202 + jobId, runs audit), `admin/seed` (JSON upload, idempotent).
- Cron `football-data-sync` (`SyncCron`).

**Doğrulama:** Seed yükle → lig/takım/oyuncu sayıları artıyor; sync job çalışıyor + `SyncRun` kaydı düşüyor.

## Faz 8 — Sağlamlaştırma & Paritie
**Hedef:** Prod hazır + davranış paritesi.
- Idempotency interceptor, rate-limit policy'leri (auth/write/global), exception envelope tam.
- OpenTelemetry, Swagger tam, health, forwarded headers/trust proxy.
- (Opsiyonel) iki process (API + worker) ayrımı.
- Tam regresyon: `02` endpoint listesini baştan sona eski backend ile diff.

**Doğrulama:** `00-OVERVIEW.md` §7 checklist tamamı yeşil. Mobil uygulama + bot sözleşmeleri kırılmamış.

---

## Sıralama Notları & Riskler
- **Bot bağımlılığı:** `POST /api/rumours`, `POST /api/admin/transfers`, `GET /api/search`, `GET /api/players/search`, `POST /api/auth/login` sözleşmeleri **kesinlikle** korunmalı (bkz. `TRANSFER_BOT_SPEC.md`).
- **DB paylaşımı:** Geçiş döneminde eski .NET ve yeni NestJS aynı DB'ye bakabilir — şema birebir olduğu için. Trafiği uç bazında kaydırabilirsin (strangler-fig). Bunun için response şekilleri tam aynı olmalı.
- **Enum saklama biçimi** (string vs smallint) en sık hata kaynağı — Faz 1'de net çöz.
- **Soft delete & notification dedup & favourite opt-out** davranışlarını atlamak kolaydır; her birini ilgili fazda explicit test et.
- **Async 202 uçları**: senkron yapma — outbox/job davranışını koru.
- **Tarih semantiği:** kart sıralaması `createdAt`'e bakar, `transferDate`'e değil.
