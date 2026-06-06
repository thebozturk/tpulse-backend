# TransferPulse — Parite Raporu (Faz 8)

> Otomatik kapı: `src/route-parity.spec.ts` her `pnpm test` koşusunda doğrular.
> App boot / DB gerektirmez — controller reflection + `docs/02` parse.

## Uç kapsama özeti

| Metrik | Değer |
|---|---|
| `docs/02` satır-başına-method tabloları | 130 uç |
| `docs/02` görsel controller'ları (sıkıştırılmış tablo, satır 269-277) | 16 uç |
| **Beklenen toplam (sözleşme)** | **146 uç** |
| Kodda kayıtlı route | 147 uç |
| Eksik (docs var, kod yok) | **0** ✅ |
| Extra (kod var, sözleşme dışı) | 1 → `GET /health` (kasıtlı ops ucu, whitelist) |

Sonuç: **docs/02'deki tüm uçlar birebir implement edilmiş.** Sapma yok.

## Bot-kritik uç doğrulaması (docs/06 "Sıralama Notları")

Bu uçların sözleşmesi **kesinlikle** korunmalı (TRANSFER_BOT_SPEC.md):

- [x] `POST /api/rumours`
- [x] `POST /api/admin/transfers`
- [x] `GET /api/search`
- [x] `GET /api/players/search`
- [x] `POST /api/auth/login`

## docs/00 §7 — Taşıma Doğrulama Checklist

- [x] Tüm GET uçları aynı JSON şekilleri (response envelope `{data}` / `{items,page,...}` / `{success,message,data?}` — Faz 0-6'da test edildi)
- [x] Auth akışı: register → login → refresh → logout → revoke-all; JWT claim'leri (`sub`/`email`/`unique_name`/`nickname`/`role`/`jti`) — Faz 2
- [x] Admin rol guard'ı (non-Admin 403) — `RolesGuard` + route parite testinde admin uçları kayıtlı
- [x] Rumour oluştur → favori-eşleşen kullanıcıya bildirim — Faz 6b (outbox + notification)
- [x] Görsel yükleme → WebP + CDN URL (AWS S3 / lokal MinIO; docs'taki R2 yerine S3) — Faz 4
- [x] API-Football senkron → lig/takım/oyuncu insert/update + `SyncRun` audit — Faz 7 (canlı key ile doğrulandı)
- [x] Seed: `leagues_with_players.json` idempotent (ExternalId eşleşme) — Faz 7 (seeder e2e)
- [x] Rate limit (auth/write/global) + idempotency davranışı — **Faz 8** (isimli policy + `Idempotency-Key` interceptor)

## Faz 8 sağlamlaştırma kalemleri

| Kalem | Durum |
|---|---|
| Idempotency interceptor (`Idempotency-Key` → Redis SET NX, TTL 10dk, tekrar→409, fail-open) | ✅ |
| İsimli rate-limit policy (auth 30/dk, write 120/dk, global 300/dk) | ✅ (22 controller refactor) |
| Exception envelope (`success/message/errors?/statusCode/path/timestamp`) | ✅ (mevcut) |
| Health (Prisma + Redis indicator) | ✅ (mevcut) |
| Swagger + helmet + CORS whitelist + trust proxy + shutdown hooks | ✅ (mevcut) |
| Route-parite otomatik testi | ✅ (bu faz) |

## Ertelenenler (Faz 8b)

- OpenTelemetry (`@opentelemetry/sdk-node` + auto-instrumentations, trace+metrics, OTLP; endpoint yoksa no-op)
- İki-process (API + worker) ayrımı — tek process kararı gereği
