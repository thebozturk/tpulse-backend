# faz-bo-1-admin-foundation

> TransferPulse Back Office — Faz BO-1. Kaynak: `docs/backoffice/BACKOFFICE-BACKEND-ROADMAP.md` (Faz BO-1).
> **Branch:** `feature/faz-bo-1-admin-foundation` · **Tahmin:** ~3-4 gün

## Amaç

Back office iskeleti + güvenlik temeli + ilk değerli ekran (dashboard overview). Banlı/suspend kullanıcının JWT'sini anlık geçersiz kılan **status enforcement** bu fazda kurulur (roadmap Madde 8'in ilk yarısı). Mevcut `api/admin/*` route'ları korunur — kırılma yok.

## Alınan teknik kararlar

- **Ban/durum enforcement — Redis write-through status cache + `revokeAllForUser` + kısa access token (büyük sistem pratiği).**
  - Access token kısa ömürlü tutulur (5–15 dk); refresh token rotasyonlu (mevcut `TokenService`).
  - `JwtAuthGuard`, JWT'yi doğruladıktan sonra `user:status:{id}` Redis key'inden kullanıcı durumunu okur. **Miss → DB'den 1 kez okuyup cache'ler** (TTL ~60sn). Durum `Active` değilse → `403 Forbidden` (Banned/Suspended/Inactive).
  - **Gerekçe:** Tek mekanizma dört `UserStatus` durumunu da (Active/Inactive/Banned/Suspended) kapsar; instant; DB'yi her istekte dövmez. Redis denylist sadece ban'i (binary), tokenVersion sadece "oturum iptali"ni çözerdi — status-cache en eksiksiz olan.
  - Durum yazımı BO-2'de (`PATCH .../status`) bu cache'i günceller + `revokeAllForUser` çağırır. BO-1'de **okuma/guard tarafı** kurulur; yazım tarafı BO-2'ye bağlanır.
  - `@Public()` uçları (login/register/health) bu kontrolden muaf (mevcut davranış korunur).
- **Modül yapısı — yeni feature modülleri ekle, mevcuda dokunma (additive).**
  - Dashboard yeni `src/admin/dashboard/` modülü olarak eklenir. Mevcut `admin-*.controller`'lar yerinde kalır, taşınmaz. İleride istenirse `src/admin/` namespace altında toplanır — bu fazda risk alınmaz.
- **Dashboard cache — Redis, kısa TTL.** Ağır `count` sorguları `dashboard:overview` key'inde 60–120sn cache'lenir (mevcut `RedisService`).
- **Ertelenen geliştirme:** `GET .../dashboard/timeseries` (grafik verisi) bu fazda **yapılmaz** — sadece `overview` counts. Sonraki geliştirme turuna bırakıldı.

## API (yeni uçlar)

- `GET /api/admin/dashboard/overview` →
  ```jsonc
  { "data": {
      "users":      { "total": n, "activeToday": n, "newThisWeek": n },
      "content":    { "transfers": n, "rumours": n, "news": n, "posts": n, "comments": n },
      "moderation": { "pendingReports": 0 },   // BO-3 gelene dek 0
      "recent":     [ /* son aktiviteler, hafif liste */ ]
  } }
  ```

## Modeller

- Yeni model **yok**. (Schema değişikliği yok.)

## Dosya yapısı

```
src/common/guards/jwt-auth.guard.ts        # status enforcement eklenir (Redis-backed)
src/common/auth/user-status.cache.ts       # user:status:{id} read-through cache helper (yeni)
src/admin/dashboard/
├─ dashboard.module.ts
├─ dashboard.controller.ts                  # GET /api/admin/dashboard/overview
├─ dashboard.service.ts                     # prisma count + redis cache
└─ dto/dashboard-overview.response.dto.ts   # @ApiProperty tipli response
```

## Kurallar

- Controller: `@UseGuards(RolesGuard)` + `@Roles('Admin')`; `@ApiTags('admin-dashboard')`.
- Guard status kontrolü read-only; ban/suspend mesajı net (`'User is banned'` / `'User is suspended'`).
- Cache miss fallback DB; Redis down ise DB'ye düş (fail-open değil — durum yine DB'den doğrulanır).
- Response envelope: `@ApiSingleResponse(DashboardOverviewResponseDto)`.
- `CORS_ALLOWED_ORIGINS` env'e BO web origin eklenir (varsa).

## Test

- **Unit:** dashboard.service count + cache hit/miss.
- **E2E:** banned kullanıcı korumalı uca → 403; active → 200. `@Public()` uç banned'da bile geçer.
- **Edge:** Redis down → DB fallback ile doğru status.

## Dependencies

- Yeni paket yok (ioredis, prisma, swagger helper'ları mevcut).

## Env variables

- `CORS_ALLOWED_ORIGINS` (mevcut, BO origin eklenir)
- `JWT_ACCESS_EXPIRY` kısa tutulur (varsa teyit; yoksa config'e eklenir, default 15m)

## Build order

1. `user-status.cache.ts` helper (Redis read-through).
2. `JwtAuthGuard`'a status enforcement (cache → DB fallback).
3. Dashboard module + service (count + cache) + controller + response DTO.
4. CORS env.
5. Test (guard e2e + service unit).
6. `pnpm tsc --noEmit && pnpm lint && pnpm test` + `openapi:gen` publish.
