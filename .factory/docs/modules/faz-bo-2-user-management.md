# faz-bo-2-user-management

> TransferPulse Back Office — Faz BO-2. Kaynak: `docs/backoffice/BACKOFFICE-BACKEND-ROADMAP.md` (Faz BO-2).
> **Branch:** `feature/faz-bo-2-user-management` · **Tahmin:** ~3-4 gün
> **Bağımlılık:** BO-1 (status enforcement guard + Redis status cache).

## Amaç

Owner kullanıcıları tam yönetebilsin: durum (ban/suspend/activate), rol, itibar, detay + içerik görüntüleme. Ban anında oturum kapatma (Madde 8 tamamlanır).

## Alınan teknik kararlar

- **Ban → anlık oturum kapatma:** `PATCH .../status` Banned/Suspended/Inactive'e geçirdiğinde:
  1. `TokenService.revokeAllForUser(id)` (mevcut) — tüm refresh token iptal.
  2. **BO-1 status cache güncellenir** (`user:status:{id}` set/del) — guard anında 403 döner.
  - Active'e geri alındığında cache güncellenir; kullanıcı yeniden login olur.
- **Son admin koruması:** rol düşürme/ban öncesi `role='Admin' && status='Active'` sayısı kontrol edilir; **son aktif admin** düşürülemez/banlanamaz → `409 Conflict`. Yarış durumu için işlem transaction içinde sayım + güncelleme.
- **Schema — `bannedAt` + `banReason` eklenir** (`User` modeli, native enum `UserStatus` mevcut). Migration ile. Audit (BO-4) gelene dek minimal iz.
- **Arama — Postgres `pg_trgm`** (mevcut extension + trgm index migration'ı var): `q` parametresi username/email/nickname üzerinde ILIKE/trgm.
- **DTO ayrımı:** `AdminUpdateUserStatusDto`, `AdminUpdateRoleDto`, `AdminUpdateReputationDto` ayrı; class-validator + `@ApiProperty` + enum.
- **Reputation:** `delta` (artımlı) **veya** `value` (mutlak) — ikisinden biri (`@ValidateIf`), ikisi birden gelirse 400.

## API (yeni/güçlendirilen uçlar)

- `GET  /api/admin/users?status=&role=&q=&page=&pageSize=` — filtre + arama (paged envelope).
- `GET  /api/admin/users/:id` — profil detayı.
- `GET  /api/admin/users/:id/content?type=posts|comments|transfers&page=` — kullanıcı içeriği (paged).
- `PATCH /api/admin/users/:id/status`     `{ status: Active|Inactive|Banned|Suspended, reason? }`
- `PATCH /api/admin/users/:id/role`       `{ role: User|Admin }`
- `PATCH /api/admin/users/:id/reputation` `{ delta? | value? }`

## Modeller

- `User` (değişiklik): `bannedAt: DateTime?`, `banReason: String?` (maxlength ~500). Migration gerekli.

## Dosya yapısı

```
prisma/schema.prisma                        # User + bannedAt/banReason
prisma/migrations/<ts>_add_user_ban_fields/
src/users/
├─ admin-users.controller.ts                # yeni admin uçları (mevcut users.controller'a dokunmadan)
├─ users.service.ts                          # status/role/reputation methodları + son-admin guard
└─ dto/
   ├─ admin-update-user-status.dto.ts
   ├─ admin-update-role.dto.ts
   ├─ admin-update-reputation.dto.ts
   ├─ admin-user-list.query.dto.ts           # status/role/q/page
   └─ admin-user-detail.response.dto.ts
```

## Kurallar

- `@UseGuards(RolesGuard)` + `@Roles('Admin')`; mutating uçlarda `@Throttle(ThrottlePolicies.write)`.
- Status değişimi service'te atomik: revokeAll + cache update + (BO-4'te audit). Sıralama: DB update → token revoke → cache update.
- Hassas alan response'a sızmaz (`select:false` / response DTO whitelist).
- Son aktif admin → `ConflictException`.
- Reputation `delta`/`value` mutual exclusive.

## Test

- **E2E:** ban → eski access token korumalı uca 403 (BO-1 guard ile uçtan uca); refresh token geçersiz.
- **Unit:** son-admin koruması (düşürme/ban engeli), reputation delta vs value, status cache update çağrısı.
- **Edge:** geçersiz status/role enum → 400; var olmayan user → 404.

## Dependencies

- Yeni paket yok.

## Build order

1. Migration: `User.bannedAt/banReason`.
2. DTO'lar (status/role/reputation/list query/detail response).
3. `users.service` methodları (status+revokeAll+cache, role+son-admin, reputation, list+trgm, detail, content).
4. `admin-users.controller`.
5. Test (ban e2e + son-admin unit).
6. `pnpm tsc --noEmit && pnpm lint && pnpm test` + `openapi:gen` publish.
