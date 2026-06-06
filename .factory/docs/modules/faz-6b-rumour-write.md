# faz-6b-rumour-write

> Faz 6 (Favoriler & Bildirimler) 2/2. Kaynak: docs/02-04. Rumour write (create/update/delete/confirm) + notification tetiği. Rumour = isRumour:true transfer.

## Amaç

Rumour yazma uçları + her birinde notification.generate (6a outbox event reuse). Bot `POST /api/rumours` sözleşmesi kritik.

## Kararlar

- **Confirm:** aynı satırı güncelle (isRumour:false + fee/date). transferId = rumour id (referanslar korunur).
- **PUT/DELETE yetkisi:** yazar VEYA Admin (moderasyon). createdByUserId===user || role==='Admin', değilse 403.
- Rumour create: transferDate=**now (server-set)**, isRumour:true, source=Manual, createdByUserId=user, feeAmount default 0 / feeCurrency default 'EUR'.

## Endpoint'ler (mevcut RumourController'a eklenir — read @Public, write auth+role)

| Method | Route | Auth | Response |
|---|---|---|---|
| POST | `/api/rumours` | Admin\|Reporter | 201 `{data:{rumourId}}` / 404 (player/team) — notification(Rumour). **bot** |
| PUT | `/api/rumours/:id` | Admin\|Reporter | 200 / 403 (yazar/admin değil) / 404 |
| DELETE | `/api/rumours/:id` | Admin\|Reporter | 200 (soft delete) / 403 / 404 |
| POST | `/api/rumours/:id/confirm` | Admin | 200 `{data:{transferId}}` / 404 — rumour→transfer, notification(Transfer) |

Guard: `@UseGuards(RolesGuard)` + `@Roles('Admin','Reporter')` (confirm `@Roles('Admin')`). PUT/DELETE author-or-admin kontrolü serviste.

## DTO'lar (docs/03)

- **CreateRumourDto:** playerId(uuid), fromTeamId(uuid), toTeamId(uuid), feeAmount?(>=0), feeCurrency?(≤10)
- **UpdateRumourDto:** aynı
- **ConfirmRumourDto:** feeAmount(>=0), feeCurrency(≤10), transferDate(Date)

## Repository (TransferRepository — EXTENDED_PRISMA)

Eklenecek metodlar:
- `createRumour(data)` → {id} (isRumour:true, transferDate:now, source:Manual). FK 404 (mapWriteError).
- `getRumourMeta(id)` → `{createdByUserId, isRumour}` | null (author + isRumour kontrolü; soft-delete-aware).
- `updateRumour(id, data)` → boolean.
- (delete) mevcut `softDelete(id)` reuse.
- `confirmRumour(id, {feeAmount, feeCurrency, transferDate})` → boolean (isRumour:false + alanlar).

## Service (RumourWriteService veya RumoursService genişler)

- **create(dto, userId):** createRumour → enqueue `notification.generate {transferId:id}` (generation isRumour:true → Rumour event) → {id}.
- **update(id, user, dto):** meta=getRumourMeta; null/!isRumour → 404; (createdByUserId!==user && role!=='Admin') → 403; updateRumour.
- **remove(id, user):** meta; 404; author/admin 403; softDelete.
- **confirm(id, dto):** meta; null/!isRumour → 404; confirmRumour → enqueue notification.generate (artık isRumour:false → Transfer event) → {transferId:id}.

## Test

- **Unit:** rumour-write.service (create→enqueue, update 403 non-author/non-admin, update 404 not-rumour, confirm→isRumour:false+enqueue, author-or-admin matrisi).
- **E2E (BullMQ):** Reporter POST rumour → 201 + favori eşleşen kullanıcıya **Rumour** bildirimi; başka Reporter PUT → 403; Admin PUT başkasının → 200 (admin); confirm (Admin) → transfer'e döner (/transfers'ta görünür, /rumours'tan çıkar) + **Transfer** bildirimi; soft delete.

## Doğrulama (docs/06 Faz 6 — 6b)

- [ ] rumour create 201 + Rumour bildirimi; transferDate server-set.
- [ ] PUT/DELETE author-or-admin (403 aksi); not-rumour id → 404.
- [ ] confirm → isRumour:false (/transfers'ta, /rumours'tan çıkar) + Transfer bildirimi.
- [ ] bot sözleşmesi: POST /api/rumours şekli korunur.
- [ ] tsc + lint + unit + e2e temiz.

## Build sırası

1. TransferRepository rumour write metodları.
2. Rumour write DTO'ları + service.
3. RumourController'a write uçları (RolesGuard).
4. Unit + e2e + tsc + lint + commit.

## Sonraki

Faz 6 TAMAM (tüm özellik fazları bitti). → Faz 7 (API-Football sync & seed) → Faz 8 (hardening: idempotency interceptor, rate-limit policy, OpenTelemetry, regresyon paritesi).
