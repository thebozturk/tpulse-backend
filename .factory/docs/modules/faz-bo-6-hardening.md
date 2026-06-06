# faz-bo-6-hardening

> TransferPulse Back Office — Faz BO-6. Kaynak: `docs/backoffice/BACKOFFICE-BACKEND-ROADMAP.md` (Faz BO-6).
> **Branch:** `feature/faz-bo-6-hardening` · **Tahmin:** ~2-3 gün

## Amaç

BO uçlarını yayına hazırla: rate limit politikaları, RBAC ince ayar zemini, güvenlik baseline doğrulama, gözlemlenebilirlik, tam contract + e2e smoke.

## Alınan teknik kararlar

- **Rate limit:** admin yazma/silme uçlarına uygun `@Throttle` politikaları (mevcut `ThrottlePolicies` genişletilir — ör. `adminWrite`, `adminBulk`). Global throttle korunur.
- **RBAC ince ayar — zemin hazırla, uygulama ertelendi.** Şimdilik **Admin/User** kalır. İleride "Moderator" / granular permission için genişletilebilir yapı (decorator/metadata) yorumlanır ama **yeni rol bu fazda eklenmez** — ertelenen geliştirme.
- **2FA/TOTP — ertelenen geliştirme.** Bu fazda **yapılmaz**; roadmap'te opsiyonel. Sonraki tura bırakıldı.
- **Güvenlik baseline doğrulama:** hassas alanlarda `select:false`/response whitelist denetimi, BO origin CORS whitelist teyidi, `helmet` kontrolü. `/secure` 8-kategori audit çalıştırılır.
- **Gözlemlenebilirlik:** admin aksiyon metrikleri mevcut OpenTelemetry'ye bağlanır (sayaç/span); ağır yeni altyapı yok.
- **Contract & E2E:** tam `openapi.json` publish; tüm BO uçları için e2e smoke; coverage hedefleri (unit >80%, kritik path e2e).

## API

- Yeni uç yok (mevcutların sertleştirilmesi).

## Modeller

- Yeni model yok.

## Dosya yapısı

```
src/common/throttle/throttle-policies.ts     # adminWrite/adminBulk eklenir
src/common/...                                # select:false / CORS / helmet doğrulama (gerekirse düzeltme)
test/e2e/                                     # BO uçları smoke e2e
openapi.json                                  # tam publish
```

## Kurallar

- Tüm admin mutating uçlarında uygun throttle.
- Hassas alanlar response'a sızmaz (audit ile teyit).
- `/secure` çıktısında kritik (BLOCK) bulgu kalmaz.

## Test

- **E2E smoke:** her major BO flow 1 smoke (dashboard, user status, moderation delete, report, audit list, broadcast, currency).
- **Coverage:** modül bazında hedefler; `/test coverage` ile boşluk taraması.
- `/secure` audit temiz.

## Dependencies

- Yeni paket yok.

## Build order

1. Throttle politikaları (adminWrite/adminBulk) admin uçlarına.
2. Güvenlik baseline doğrulama (select:false / CORS / helmet) + `/secure`.
3. OpenTelemetry admin aksiyon metrikleri.
4. BO e2e smoke + coverage.
5. Tam `openapi:gen` publish + contract breaking-change check.
6. `pnpm tsc --noEmit && pnpm lint && pnpm test && pnpm test:e2e`.
