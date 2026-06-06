# TransferPulse — .NET → NestJS Migration: Genel Bakış (00)

> Bu doküman seti, mevcut **TPulseBackend** (.NET 8 / Clean Architecture) projesini **NestJS**'e bire bir taşımak için hazırlanmıştır. Amaç: bir AI ajanına (veya geliştiriciye) verildiğinde, davranışı **birebir koruyarak** yeni bir NestJS projesi kurabilecek kadar detay sağlamak.

## Doküman Haritası

| Dosya | İçerik |
|---|---|
| `00-OVERVIEW.md` | Bu dosya — proje özeti, mimari, modül haritası, taşıma stratejisi |
| `01-DATA-MODEL.md` | Tüm domain entity'leri, enum'lar, ilişkiler, EF config → **Prisma schema** |
| `02-API-ENDPOINTS.md` | 30 controller'ın **tüm endpoint'leri** (route, auth, params, body, response) |
| `03-APPLICATION-LOGIC.md` | İş mantığı (CQRS), validation kuralları, DTO şekilleri, servis/repository sözleşmeleri |
| `04-INFRASTRUCTURE.md` | Auth/JWT, Redis cache, R2 storage, API-Football senkron, outbox/messaging, email, config & env |
| `05-NESTJS-ARCHITECTURE.md` | **Hedef** NestJS proje yapısı, modül tasarımı, kavram eşleme tablosu, kütüphane seçimleri |
| `06-MIGRATION-ROADMAP.md` | Faz faz taşıma planı, sıralama, doğrulama kriterleri |

> **Okuma sırası:** Önce `00` ve `05` (ne yapacağını anla), sonra `01` (şema kur), sonra `04` (altyapı iskeleti), sonra `02` + `03` (modül modül endpoint'leri taşı), `06` ile sırayı takip et.

---

## 1. Proje Nedir?

TransferPulse, futbol **transfer/söylenti (rumour) takip** uygulamasının backend'idir. Mobil uygulamaya şunları sunar:

- **Veri katalogu:** Ligler, takımlar, oyuncular, pozisyonlar (API-Football'dan senkronlanır veya JSON'dan seed edilir).
- **Transfer & rumour akışı:** Kesinleşmiş transferler ve söylentiler; istatistik, sezon dashboard'u, dönem (transfer window) özetleri.
- **Sosyal katman:** Post (paylaşım), yorum (post + transfer üzerine), beğeni, oylama (agree/disagree).
- **Kullanıcı:** Kayıt/giriş (email + Google), JWT + refresh token, profil fotoğrafı, şifre sıfırlama.
- **Kişiselleştirme:** Favoriler (lig/takım/oyuncu/reporter) ve favorilere bağlı **bildirimler** (in-app).
- **Admin:** Lig/takım/oyuncu/haber/transfer/dönem CRUD, görsel yükleme, veri senkron/seed tetikleme.
- **Arama:** `pg_trgm` tabanlı fuzzy arama (oyuncu/takım/lig).

> Not: Ayrıca `TRANSFER_BOT_SPEC.md` ayrı bir **bot** projesini tanımlar; bu backend'in *tüketicisidir*, taşıma kapsamı değildir. Bot, buradaki `POST /api/rumours`, `POST /api/admin/transfers`, `GET /api/search`, `GET /api/players/search` uçlarını kullanır — yani bu uçların sözleşmesi **bozulmamalıdır**.

---

## 2. Mevcut Mimari (.NET Clean Architecture)

4 katmanlı solution (`TransferPulse.sln`):

```
TransferPulse.Domain          → Entity'ler, enum'lar, BaseEntity (saf C#, bağımlılık yok)
TransferPulse.Application      → CQRS (MediatR), DTO'lar, validator'lar (FluentValidation),
                                 servis/repository INTERFACE'leri (sözleşmeler)
TransferPulse.Infrastructure   → EF Core (Npgsql), repository IMPLEMENTASYONLARI, JWT, Redis,
                                 R2 storage, API-Football client, Hangfire, email, search
TransferPulse.Api              → Controller'lar, middleware, filters, Program.cs (DI + pipeline)
tests/                         → xUnit unit + integration (Testcontainers)
```

**Teknoloji yığını (mevcut):**

| Konu | .NET tarafı |
|---|---|
| Runtime | .NET 8, C# (LangVersion: latest) |
| Web | ASP.NET Core Controllers |
| ORM | Entity Framework Core + Npgsql (PostgreSQL 16) |
| CQRS | MediatR (Command/Query/Handler) |
| Validation | FluentValidation + MediatR `ValidationBehavior` pipeline |
| Auth | JWT Bearer + refresh token; BCrypt parola hash; Google ID token doğrulama |
| Cache / dedup | Redis (`StackExchange.Redis`) — cache-aside + idempotency |
| Background jobs | **Hangfire** (Redis storage) — outbox dispatcher, football sync, reaction handler |
| Messaging | **Outbox pattern** (DB tablosu) + Hangfire dispatcher + event publisher |
| Storage | **Cloudflare R2** (S3 uyumlu, `AWSSDK.S3`) — görsel; `SixLabors.ImageSharp` → WebP |
| Dış veri | **API-Football** (api-sports.io) — lig/takım/oyuncu/transfer senkronu |
| Search | PostgreSQL `pg_trgm` fuzzy (Elasticsearch'e geçişe hazır soyutlama) |
| Email | SMTP (`System.Net.Mail`) — şifre sıfırlama |
| Observability | OpenTelemetry (trace + metrics, OTLP) |
| API docs | Swagger (Swashbuckle) |
| Rate limit | ASP.NET Core RateLimiter (global / auth / write policy) |

---

## 3. Sayısal Kapsam (taşınacak yüzey)

| Öğe | Adet |
|---|---:|
| Controller | 30 |
| Endpoint (yaklaşık) | ~120 |
| Domain entity | 25 |
| Enum | 6 |
| Uygulama interface'i (servis/repo) | ~28 |
| DTO | ~60 |
| EF entity configuration | 22 |
| Application katmanı .cs dosyası | ~145 |
| Infrastructure katmanı .cs dosyası | ~121 |

---

## 4. Hedef Mimari (NestJS) — Özet

Mevcut Clean Architecture'ı NestJS'in **feature-module** yapısına çeviriyoruz. Detaylar `05-NESTJS-ARCHITECTURE.md`.

| .NET kavramı | NestJS karşılığı |
|---|---|
| Controller | `@Controller` (aynı route'lar) |
| MediatR Command/Query + Handler | Service metodu (veya istenirse `@nestjs/cqrs`) |
| FluentValidation validator | `class-validator` decorator'lı DTO + global `ValidationPipe` |
| `IServiceCollection` DI | `@Module` providers |
| EF Core + `ApplicationDbContext` | **Prisma** (önerilen) veya TypeORM |
| Repository sınıfları | Prisma tabanlı service/repository provider'ları |
| JWT Bearer + `[Authorize(Roles=...)]` | `@nestjs/passport` (`passport-jwt`) + `JwtAuthGuard` + `RolesGuard` |
| BCrypt | `bcrypt` / `bcryptjs` |
| Redis (`StackExchange.Redis`) | `ioredis` (+ `@nestjs/cache-manager`) |
| Hangfire | **BullMQ** (`@nestjs/bullmq`) + `@nestjs/schedule` (cron) |
| Outbox + dispatcher | Aynı DB tablosu + cron'la tetiklenen BullMQ processor |
| AWSSDK.S3 (R2) | `@aws-sdk/client-s3` |
| SixLabors.ImageSharp | `sharp` |
| API-Football HttpClient | `@nestjs/axios` (+ retry) |
| SMTP | `nodemailer` (`@nestjs-modules/mailer`) |
| Rate limiter | `@nestjs/throttler` |
| Swagger | `@nestjs/swagger` |
| OpenTelemetry | `@opentelemetry/sdk-node` |

> **ORM kararı:** Prisma önerilir (tip güvenliği + migration ergonomisi yüksek, AI ile çalışması kolay). 01 dosyasında şema doğrudan Prisma olarak verilmiştir. TypeORM tercih edilirse aynı tablo/kolon eşlemeleri geçerlidir.

---

## 5. Taşıma Stratejisi (ilkeler)

1. **Sözleşme korunur:** Route'lar, HTTP method'ları, request/response gövdeleri ve response envelope'ı (`{ success, message, data }`, sayfalama `{ items, page, pageSize, totalCount, totalPages }`) **birebir** korunmalı — mobil uygulama ve bot kırılmasın.
2. **Aynı DB şeması:** Tablo adları, kolon adları, index/unique kısıtları, enum saklama biçimi (string/short) korunur ki **mevcut PostgreSQL verisi** yeni backend ile çalışsın. Migration'ı sıfırdan değil, var olan şemaya **eşleyerek** kur (Prisma `db pull` ile başlamak iyi bir başlangıçtır).
3. **UTC + GUID:** Tüm tarihler UTC, tüm ID'ler `uuid`. Para alanları `decimal` (Prisma `Decimal`).
4. **Faz faz, çalışır durumda bırak:** Her faz sonunda derlenebilir/çalışır bir durum. Sıralama `06`'da.
5. **Davranış farklarına dikkat:** Bazı uçlar **asenkron kuyruğa** alınır (`202 Accepted`): post/comment create, post/comment like/unlike → outbox + BullMQ. Bunları senkron yapma; davranışı koru.
6. **Soft delete:** `Transfer` entity'sinde global soft-delete filtresi var (`IsDeleted = false`). Prisma'da bunu her sorguda explicit `where` veya extension/middleware ile uygula.

---

## 6. Bilinen Nüanslar / Tuzaklar

- **Transfer kart zamanı = `CreatedAt`**, `TransferDate` değil (mobil sıralama `createdAt`'e bakar). Rumour'da `TransferDate` sunucuda `now` set edilir. (Bkz. memory: transfer-date-semantics.)
- **Notification dedup:** `(UserId, TransferId, EventType)` unique — bir kullanıcıya aynı transfer için aynı tip bildirim iki kez gitmez.
- **Favourite opt-out bildirimleri:** `NotificationPreference` satırı **yoksa** açık kabul edilir (opt-out modeli).
- **Favourite feed filtresi:** Lig favorisi, feed filtrelemesi için **takım ID'lerine genişletilir**.
- **Post check-constraint:** `PostType`'a göre hangi FK alanlarının dolu/null olacağı DB seviyesinde zorlanır (bkz. 01). NestJS tarafında DTO validation + DB constraint birlikte.
- **Image lock flag'leri:** `LogoLockedByAdmin` / `PhotoLockedByAdmin` — admin görsel yüklediğinde set edilir; senkron bu görselleri **ezmez**.
- **Idempotency:** Yazma uçlarında `Idempotency-Key` header'ı + Redis `SET NX` ile tekrar koruması (10 dk TTL).
- **pg_trgm:** Arama için PostgreSQL `pg_trgm` extension'ı gerekir (`CREATE EXTENSION`).

---

## 7. Doğrulama (taşıma bitti demeden önce)

- [ ] Mevcut DB'ye bağlanıp tüm GET uçları aynı JSON şekillerini döndürüyor.
- [ ] Auth akışı: register → login → refresh → logout → revoke-all çalışıyor; JWT claim'leri aynı (`sub`, `email`, `role`, ...).
- [ ] Admin rol guard'ı çalışıyor (Admin olmayan 403).
- [ ] Rumour oluştur → bildirim üretimi tetikleniyor (favori eşleşen kullanıcıya).
- [ ] Görsel yükleme → R2'ye WebP çıkıyor, CDN URL dönüyor.
- [ ] API-Football senkron job'u lig/takım/oyuncu insert/update yapıyor; `SyncRun` audit kaydı düşüyor.
- [ ] Seed: `leagues_with_players.json` yüklenebiliyor (idempotent, ExternalId ile eşleşme).
- [ ] Rate limit ve idempotency davranışı korunmuş.
