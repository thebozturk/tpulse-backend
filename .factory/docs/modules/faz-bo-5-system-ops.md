# faz-bo-5-system-ops

> TransferPulse Back Office — Faz BO-5. Kaynak: `docs/backoffice/BACKOFFICE-BACKEND-ROADMAP.md` (Faz BO-5).
> **Branch:** `feature/faz-bo-5-system-ops` · **Tahmin:** ~3 gün

## Amaç

Sistem operasyonları: toplu bildirim (broadcast), döviz kuru yönetimi, mevcut senkron uçlarını BO'ya bağlama.

## Alınan teknik kararlar

- **Broadcast — BullMQ queue üzerinden batch (mevcut `@nestjs/bullmq` altyapısı).**
  - `POST .../broadcast` aksiyonu bir job enqueue eder; processor kullanıcıları **batch** halinde işleyip `Notification` kayıtları üretir. Senkron döngü ile binlerce kullanıcı **bloklanmaz**.
  - **Gönderim geçmişi:** broadcast başlıkları için kayıt (yeni hafif tablo `BroadcastMessage` **veya** mevcut SyncRun benzeri audit). Karar: hafif `BroadcastMessage` tablosu (id, title, body, target, status, sentCount, createdBy, createdAt).
  - **Ertelenen geliştirme:** `target: segment` (filtreli hedefleme) bu fazda **yok** — sadece `target: all`. Segment sonraki tura bırakıldı.
- **Döviz — manuel CRUD (mevcut `CurrencyRate` modeli, transfer ücreti çevriminde kullanılıyor).**
  - `GET/POST/PUT/DELETE /api/admin/currency-rates`. Unique constraint `(currencyCode, baseCurrencyCode, rateDate)` mevcut — duplicate → 409.
  - **Ertelenen geliştirme:** otomatik dış kaynaktan kur çekme (cron/3rd-party) bu fazda **yok**.
- **Sync — yeni model yok.** Mevcut `admin-sync.controller` + `GET /api/admin/sync/runs` + `SyncRun` tablosu BO'ya bağlanır; gerekirse senkron iptal/zamanlama **bilgisi** (read) eklenir. Yeni ağır iş yok.

## API (yeni uçlar)

- `POST /api/admin/notifications/broadcast` `{ title, body, target: "all" }` → job enqueue, `{ data: { jobId, queued } }`
- `GET  /api/admin/notifications/broadcasts?page=` — gönderim geçmişi
- `GET/POST/PUT/DELETE /api/admin/currency-rates` — CurrencyRate CRUD
- (mevcut sync uçları BO'ya bağlanır — yeni uç gerekmiyorsa eklenmez)

## Modeller

```prisma
model BroadcastMessage {
  id         String   @id @default(uuid())
  title      String
  body       String
  target     String   @default("all")
  status     String   @default("Queued")   // Queued|Sending|Done|Failed
  sentCount  Int      @default(0)
  createdBy  String
  createdAt  DateTime @default(now())
  @@index([createdAt])
}
```
- `CurrencyRate`: mevcut, değişiklik yok (CRUD eklenir).

## Dosya yapısı

```
prisma/schema.prisma                          # BroadcastMessage
prisma/migrations/<ts>_add_broadcast/
src/admin/broadcast/
├─ broadcast.module.ts
├─ broadcast.controller.ts                     # POST broadcast, GET history
├─ broadcast.service.ts                        # enqueue + history
├─ broadcast.processor.ts                      # BullMQ — batch Notification üretimi
└─ dto/ create-broadcast.dto.ts, broadcast.response.dto.ts
src/admin/currency-rates/
├─ currency-rates.module.ts
├─ currency-rates.controller.ts                # CRUD
├─ currency-rates.service.ts
└─ dto/ create/update/list/response
```

## Kurallar

- `@Roles('Admin')` + write throttle; broadcast `@Audit('notification.broadcast')` (BO-4).
- Broadcast asla senkron döngü ile toplu yazmaz — queue + batch.
- CurrencyRate duplicate (unique) → 409; rate > 0 validation.

## Test

- **Unit:** broadcast enqueue + processor batch (mock queue) Notification üretir.
- **Unit:** currency CRUD + duplicate 409.
- **E2E:** broadcast → job queued response; currency CRUD round-trip.

## Dependencies

- Yeni paket yok (BullMQ mevcut).

## Build order

1. Migration: `BroadcastMessage`.
2. Currency-rates CRUD (basit, önce).
3. Broadcast module + service (enqueue) + processor (batch) + history.
4. Sync uçlarını BO'ya bağla (read).
5. Test (broadcast batch + currency CRUD).
6. `pnpm tsc --noEmit && pnpm lint && pnpm test` + `openapi:gen` publish.
