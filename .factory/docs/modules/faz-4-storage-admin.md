# faz-4-storage-admin

> Faz 4. Kaynak: docs/02 (admin uçları), docs/03-04 (storage/image). **Storage AWS S3 (lokal MinIO), R2 DEĞİL** (kullanıcı kararı). Tek faz: Admin CRUD + Storage + görsel controller'ları.

## Kararlar

- **Storage:** `@aws-sdk/client-s3`. Prod AWS S3; lokal/test MinIO (S3_ENDPOINT + forcePathStyle). Env `S3_*` (R2_* değil). Görsel `sharp` → WebP.
- **Admin CRUD notification YOK:** docs admin/transfers + rumour create "bildirim tetikler" der — notification Faz 6'da. 4'te saf CRUD (transfer create job tetiklemez, Faz 6 ekler).
- Admin uçları: global JwtAuthGuard + `RolesGuard @Roles('Admin')` + `@Throttle(write)`. ProfilePhoto auth'lu (kendi foto, admin değil).
- Transfer admin DELETE = soft-delete (EXTENDED_PRISMA delete→update).

## Env (yeni — S3)

```
S3_ENDPOINT=            # MinIO için http://localhost:9000; AWS'de boş
S3_REGION=us-east-1
S3_BUCKET=transferpulse
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_PUBLIC_BASE_URL=     # CDN/public base (örn http://localhost:9000/transferpulse)
S3_FORCE_PATH_STYLE=true  # MinIO true, AWS false
```

## Storage (`src/storage/`)

- **StorageService:** S3Client (endpoint varsa MinIO/forcePathStyle, yoksa AWS). `upload(buffer, folder, fileName, contentType='image/webp') → cdnUrl`, `delete(cdnUrl)`. Deterministik dosya adı (re-sync ezme).
- **ImageService (sharp):** `toWebP(buffer, quality)`, `isValidFormat(fileName)` (jpg/jpeg/png/webp), `isValidSize(bytes, maxMb=5)`. Kalite: lig 90, takım/oyuncu 85, news/profil 80.
- **ImageDownloaderService (SSRF korumalı):** `download(url) → buffer`. Public hostname doğrula (private/loopback IP bloke), izinli content-type, ≤10MB, redirect ≤3, timeout ~15s.
- **ImageMirrorService:** `mirror(sourceUrl, folder, entityId) → cdnUrl` (download→webp→upload). Faz 7 sync kullanır.
- StorageModule (@Global) exports.

## Admin CRUD — `api/admin/*` (Admin, write throttle)

| Controller | Uçlar |
|---|---|
| AdminLeague `api/admin/leagues` | POST(201 {leagueId}) · PUT(404) · DELETE(404) |
| AdminTeam `api/admin/teams` | POST(404 lig/409 isim) · PUT(404) · DELETE(404) |
| AdminPlayer `api/admin/players` | POST(404 team/position) · PUT(404) · DELETE(404) |
| AdminNews `api/admin/news` | POST(201) · PUT(400 id-mismatch/404) · DELETE(404) · DELETE /bulk (≤100) |
| AdminTransfer `api/admin/transfers` | POST(404/409 dup) · PUT(404) · PATCH(404) · DELETE(soft) |
| AdminTransferPeriod `api/admin/transfer-periods` | GET (list/by-id) · POST(400 endDate≥startDate) · PUT · DELETE |

Repository'lere write metodları eklenir (create/update/delete). Create/Update DTO'ları (docs/03). Dedup (transfer): `exists(player,from,to,date)` → 409. Team isim unique → 409.

## Görsel controller'ları (Admin) + ProfilePhoto

| Controller | Base | Uçlar | Flag |
|---|---|---|---|
| LeagueImage | `api/admin/leagues/:leagueId/image` | POST/PUT/POST from-url/DELETE | logoLockedByAdmin |
| TeamImage | `api/admin/teams/:teamId/image` | (aynı) | logoLockedByAdmin |
| PlayerImage | `api/admin/players/:playerId/image` | (aynı) | photoLockedByAdmin |
| NewsImage | `api/admin/news/:newsId/image` | (aynı) | — (imageUrl) |
| ProfilePhoto | `api/profile/photo` (auth) | POST/PUT/from-url/GET/DELETE | — |

Davranış: multipart `image` (≤5MB, jpg/png/webp) → sharp WebP → S3 upload → entity'nin logo/photo/imageUrl alanı + `*LockedByAdmin=true` set. from-url: ImageDownloader. DELETE: alan temizle + flag reset. 200 `{data:{url}}` / 400 (format/boyut) / 404.

## Yapı (özet)

```
src/storage/ (storage.service, image.service, image-downloader.service, image-mirror.service, storage.module)
src/<entity>/admin-<entity>.controller.ts + admin DTO'lar + repo write metodları + <entity>-image.controller.ts
src/profile/ (profile-photo.controller, profile.module)  # api/profile/photo
```

## Test

- **Unit:** image.service (format/size validation), image-downloader (private IP bloke), her admin service (409/404/400 dedup/mismatch), storage.service (key/url üretimi mock S3).
- **E2E (MinIO + seed):** admin CRUD status code'ları (201/404/409/400/soft-delete); görsel upload → S3'e WebP, `{data:{url}}` + LockedByAdmin set; from-url; DELETE flag reset; bulk news ≤100.

## Doğrulama (docs/06 Faz 4)

- [ ] Admin CRUD doğru status code'lar; transfer dedup 409; team isim 409; period 400.
- [ ] Görsel upload → MinIO'ya WebP, CDN URL döner; `*LockedByAdmin` set; DELETE reset.
- [ ] SSRF: private IP'li from-url reddedilir.
- [ ] tsc + lint + unit + e2e (MinIO) temiz.

## Build sırası

1. S3 env + StorageModule (storage/image/downloader/mirror).
2. Repository write metodları (6 entity).
3. Admin DTO'lar + admin controller'lar (6).
4. Görsel controller'ları (5) + ProfilePhoto modülü.
5. Module wiring.
6. Unit + MinIO e2e + tsc + lint + commit.

## Sonraki

Faz 5 — Sosyal (Post/Comment) + Messaging (outbox + BullMQ, async 202).
