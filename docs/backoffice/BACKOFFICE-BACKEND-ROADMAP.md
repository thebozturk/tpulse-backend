# TransferPulse Back Office — Backend Roadmap

> Owner/admin back office paneli için backend yol haritası. Mevcut NestJS +
> Prisma/Postgres + Redis kod tabanı üzerine kuruludur. Proje konvansiyonları
> (`feature/faz-*` branch, `@Roles('Admin')`, response envelope, OpenAPI
> contract) korunur. Tahminler kabataslaktır.

---

## 0. Mevcut Durum — Envanter

### Zaten VAR (admin uçları, `@Roles('Admin')` korumalı)

| Alan | Uçlar |
|---|---|
| Transferler | `POST/PUT/PATCH/DELETE /api/admin/transfers` |
| Duyumlar | `POST/PUT/DELETE/confirm` (rumour-write) |
| Oyuncular | `/api/admin/players` CRUD + görsel (upload/from-url/delete) |
| Takımlar | `/api/admin/teams` CRUD + görsel |
| Ligler | `/api/admin/leagues` CRUD + görsel |
| Haberler | `/api/admin/news` CRUD + `bulk` silme + görsel |
| Transfer dönemleri | `/api/admin/transfer-periods` CRUD |
| Veri senkron | `POST /api/admin/sync/football-data[/leagues/:id]`, `GET /api/admin/sync/runs` |
| Seed | `POST /api/admin/seed/football-data` |
| Kullanıcılar | `/api/users` list/get/create/update/delete (Admin-only) |
| Auth & RBAC | JWT + `RolesGuard` + `@Roles('Admin')` + `User.role` |

### EKSİK (back office için yazılacak)

1. **Kullanıcı yönetimi sığ** — `UpdateUserDto` yalnız `nickname/profilePic/
   favouriteTeam`. **Durum (ban/suspend/activate), rol değiştirme, itibar
   düzenleme YOK.** `UserStatus` enum (Active/Inactive/Banned/Suspended) modelde
   var ama hiçbir uç değiştirmiyor.
2. **İçerik moderasyonu YOK** — gönderi/yorum/transfer-yorumu yalnız **sahibi**
   silebiliyor; admin "herhangi birini sil" uçları yok. *(Akışta hakaret/ırkçı
   içerik mevcut → en yüksek öncelik.)*
3. **Şikayet/rapor sistemi YOK** — kullanıcı içerik raporlayamıyor, moderasyon
   kuyruğu yok.
4. **Dashboard metrik uçları YOK** — kullanıcı/içerik sayıları, büyüme, son
   aktivite özetleri.
5. **Audit log YOK** — admin aksiyonlarının kaydı yok.
6. **Broadcast bildirim YOK** — admin manuel/toplu bildirim gönderemiyor.
7. **Döviz kuru yönetimi YOK** — `CurrencyRate` yalnız seed ile giriliyor.
8. **Ban gerçekten uygulanmıyor** — banlı kullanıcının JWT'si hâlâ geçerli
   (status kontrolü guard'da yok), token iptali gerekiyor.

---

## Faz BO-1 — Admin Temeli & Dashboard
**Branch:** `feature/faz-bo-1-admin-foundation` · **Tahmin:** ~3-4 gün

**Amaç:** Back office'in iskeleti + ilk değerli ekran (dashboard).

- **`AdminModule`** çatısı; mevcut admin controller'ları mantıksal gruplama
  (route'lar `api/admin/*` korunur — kırılma yok).
- **Admin guard sertleştirme:** `RolesGuard`'a ek **`AdminOnlyGuard`** veya
  mevcut `@Roles('Admin')`'i tüm admin uçlarında garanti et; `JwtAuthGuard`'a
  **kullanıcı durumu kontrolü** ekle (Banned/Suspended → 403). *(Madde 8'in ilk
  yarısı.)*
- **Dashboard metrik ucu:** `GET /api/admin/dashboard/overview` →
  `{ users: {total, activeToday, newThisWeek}, content: {transfers, rumours,
  news, posts, comments}, moderation: {pendingReports}, recent: [...] }`.
  Prisma `count` + tarih filtreleri; ağır sorgular için Redis cache (60-300 sn).
- **Zaman serisi ucu (opsiyonel):** `GET /api/admin/dashboard/timeseries?metric=
  users|content&range=7d|30d` → grafik verisi.
- **CORS:** BO web origin'i `CORS_ALLOWED_ORIGINS`'e eklenir (env).
- **Testler:** dashboard servis unit + guard (banned 403) e2e.
- **Contract:** `pnpm openapi:gen` + publish.

**Yeni uçlar:** `GET /api/admin/dashboard/overview`, `.../timeseries`.

---

## Faz BO-2 — Kullanıcı Yönetimi
**Branch:** `feature/faz-bo-2-user-management` · **Tahmin:** ~3-4 gün

**Amaç:** Owner kullanıcıları tam yönetebilsin.

- **Liste güçlendirme:** `GET /api/admin/users?status=&role=&q=&page=` —
  durum/rol filtresi + arama (username/email/nickname trgm).
- **Durum yönetimi:** `PATCH /api/admin/users/:id/status` body `{ status:
  Active|Inactive|Banned|Suspended, reason? }`. **Ban'da refresh token'ları iptal
  et** (mevcut `revokeAll` mantığını yeniden kullan) → madde 8 tamamlanır.
- **Rol yönetimi:** `PATCH /api/admin/users/:id/role` `{ role: User|Admin }`
  (son admin'i düşürmeyi engelle).
- **İtibar:** `PATCH /api/admin/users/:id/reputation` `{ delta | value }`.
- **Kullanıcı detayı + içeriği:** `GET /api/admin/users/:id` (profil) +
  `GET /api/admin/users/:id/content?type=posts|comments|transfers` (sayfalı).
- **Schema:** gerekirse `User`'a `bannedAt/banReason` alanları (migration).
- **DTO'lar:** `AdminUpdateUserStatusDto`, `AdminUpdateRoleDto` (class-validator
  + enum).
- **Testler:** ban → token geçersiz e2e; son-admin koruması unit.

**Yeni uçlar:** `PATCH /api/admin/users/:id/status|role|reputation`,
`GET /api/admin/users (filtre)`, `GET /api/admin/users/:id/content`.

---

## Faz BO-3 — İçerik Moderasyonu & Şikayet  ⚠️ *Öncelikli*
**Branch:** `feature/faz-bo-3-moderation` · **Tahmin:** ~4-5 gün

**Amaç:** Admin her gönderiyi/yorumu silebilsin; kullanıcı raporlayabilsin.

- **Admin sil-her-şey uçları:**
  - `DELETE /api/admin/posts/:id`
  - `DELETE /api/admin/comments/:id`
  - `DELETE /api/admin/transfer-comments/:id`
  (Mevcut servislerde owner kontrolünü bypass eden admin yolu; cascade ile
  beğeni/oy/yanıt temizliği zaten FK'da.)
- **Moderasyon listeleri:** `GET /api/admin/posts`, `/api/admin/comments` —
  sayfalı, filtre (kullanıcı, tarih, işaretli), arama.
- **Rapor/şikayet sistemi (yeni model):**
  ```
  model Report {
    id, reporterUserId, targetType (Post|Comment|TransferComment|User),
    targetId, reason (enum: Spam|Hate|Harassment|Other), note?, status
    (Pending|Reviewed|Actioned|Dismissed), createdAt, reviewedByUserId?, reviewedAt?
  }
  ```
  - Kullanıcı: `POST /api/reports` (rapor oluştur).
  - Admin: `GET /api/admin/reports?status=`, `PATCH /api/admin/reports/:id`
    (incele/aksiyon al/reddet), aksiyonla birlikte içerik sil veya kullanıcı ban.
- **Migration:** `Report` tablosu + indexler.
- **Testler:** admin delete e2e; rapor akışı; yetki (User rapor açar, sadece
  Admin işler).

**Yeni uçlar:** admin delete (post/comment/transfer-comment), `GET
/api/admin/posts|comments`, `POST /api/reports`, `GET/PATCH /api/admin/reports`.

---

## Faz BO-4 — İçerik Üretimi Tamamlama & Audit Log
**Branch:** `feature/faz-bo-4-authoring-audit` · **Tahmin:** ~3 gün

**Amaç:** Mevcut yazma uçlarını BO ihtiyaçlarına göre tamamla + iz kaydı.

- **Var olanları doğrula/parlat:** transfer/duyum/haber/oyuncu/takım/lig yazma
  uçları zaten var → BO ile uçtan uca test, eksik response/validation tamamla.
  Duyum **"resmîleştir"** akışını (rumour confirm) gözden geçir.
- **Audit log (yeni model):**
  ```
  model AuditLog {
    id, actorUserId, action (e.g. user.ban, post.delete, transfer.create),
    targetType, targetId, metadata (json), createdAt
  }
  ```
  - Admin yazma/silme aksiyonlarında otomatik kayıt (interceptor veya servis
    katmanı). `GET /api/admin/audit-logs?actor=&action=&range=`.
- **Migration:** `AuditLog` + index.
- **Testler:** kritik aksiyonların log üretmesi.

**Yeni uçlar:** `GET /api/admin/audit-logs`.

---

## Faz BO-5 — Sistem: Bildirim Broadcast, Döviz, Senkron
**Branch:** `feature/faz-bo-5-system-ops` · **Tahmin:** ~3 gün

- **Broadcast bildirim:** `POST /api/admin/notifications/broadcast` `{ title,
  body, target: all|segment }` → mevcut `Notification` + outbox/queue üzerinden
  toplu üretim (büyük hacim için batch/queue). Gönderim geçmişi.
- **Döviz kuru yönetimi:** `GET/POST/PUT/DELETE /api/admin/currency-rates`
  (`CurrencyRate` CRUD; transfer ücreti çevriminde kullanılıyor).
- **Senkron kontrolleri:** mevcut `sync` uçları + `GET /api/admin/sync/runs`
  zaten var → BO tablosuna bağla; gerekirse senkron iptal/zamanlama bilgisi.
- **Testler:** broadcast batch; currency CRUD.

**Yeni uçlar:** `POST /api/admin/notifications/broadcast`, `/api/admin/
currency-rates` CRUD.

---

## Faz BO-6 — Sertleştirme & Yayın
**Branch:** `feature/faz-bo-6-hardening` · **Tahmin:** ~2-3 gün

- **Rate limit:** admin uçlarına uygun throttle politikaları (yazma/silme).
- **RBAC ince ayar:** ileride "Moderator" rolü için genişletilebilir izin
  yapısı (şimdilik Admin/User; opsiyonel granular permission).
- **2FA (opsiyonel):** admin login için TOTP.
- **Audit + güvenlik:** `select:false` hassas alanlar, BO origin CORS whitelist,
  helmet kontrolü.
- **Gözlemlenebilirlik:** admin aksiyon metrikleri (OpenTelemetry mevcut).
- **Contract & E2E:** tam `openapi.json` publish, BO uçları için e2e smoke,
  coverage hedefleri.

---

## Bağımlılık Sırası & Özet

```
BO-1 (temel+dashboard) ──┬─→ BO-2 (kullanıcı yönetimi) ──→ BO-3 (moderasyon) ⚠️
                         └─→ BO-4 (authoring+audit) ──→ BO-5 (sistem) ──→ BO-6 (hardening)
```

| Faz | Konu | Yeni model | Öncelik |
|---|---|---|---|
| BO-1 | Temel + Dashboard | — | Yüksek |
| BO-2 | Kullanıcı yönetimi (ban/rol) | (User alanları) | Yüksek |
| BO-3 | Moderasyon + Şikayet | `Report` | **En yüksek** |
| BO-4 | Authoring + Audit | `AuditLog` | Orta |
| BO-5 | Broadcast + Döviz + Sync | — | Orta |
| BO-6 | Hardening + Yayın | — | Orta |

**Toplam kabataslak:** ~18-22 gün (tek geliştirici). Moderasyon (BO-3) içerik
güvenliği nedeniyle BO-1/BO-2 sonrası **acil** çekilebilir.

---

## Konvansiyon Notları (mevcut kod tabanı)

- Her admin controller `@UseGuards(RolesGuard)` + `@Roles('Admin')`; mutating
  uçlarda `@Throttle(ThrottlePolicies.write)`.
- Response envelope korunur (`{ data }` / `{ items, page... }` / `{ success,
  message }`) — yeni eklenen tipli `@ApiSingleResponse`/`@ApiPagedResponse`
  helper'ları kullanılır.
- Her yeni DTO: class-validator + `@ApiProperty`; her schema değişikliği
  Prisma migration + `openapi.json` güncel.
- Feature-based klasör yapısı; `new` yerine DI; Logger inject; typed exception.
- Her faz sonu: `pnpm tsc --noEmit && pnpm lint && pnpm test` + contract publish.
