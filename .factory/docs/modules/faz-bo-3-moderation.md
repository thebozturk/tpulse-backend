# faz-bo-3-moderation

> TransferPulse Back Office — Faz BO-3. Kaynak: `docs/backoffice/BACKOFFICE-BACKEND-ROADMAP.md` (Faz BO-3). ⚠️ **En yüksek öncelik** (akışta hakaret/ırkçı içerik mevcut).
> **Branch:** `feature/faz-bo-3-moderation` · **Tahmin:** ~4-5 gün
> **Bağımlılık:** BO-2 (kullanıcı ban yeteneği — rapor aksiyonu ban tetikleyebilir).

## Amaç

Admin her gönderiyi/yorumu/transfer-yorumunu silebilsin (owner kontrolünü bypass eden admin yolu); kullanıcı içerik raporlayabilsin; admin moderasyon kuyruğunu işlesin.

## Alınan teknik kararlar

- **Admin delete — owner-bypass yolu:** mevcut servislerdeki `assertOwner()` atlanır; admin için ayrı `adminDelete(id)` method. Beğeni/oy/yanıt temizliği zaten **FK cascade** ile (schema'da Cascade tanımlı) — manuel temizlik yok.
- **Rapor sistemi — yeni `Report` modeli** (Prisma). Polimorfik hedef: `targetType` (enum) + `targetId` (string). **DB-level FK yok** (polimorfik) — uygulama katmanı hedefin varlığını kontrol eder.
- **Enum stratejisi (proje konvansiyonu):** `ReportReason` ve `ReportStatus` **native Prisma enum** (string saklanır, response'ta string döner — küçük kümeler, okunurluk). `targetType` da native enum (`Post|Comment|TransferComment|User`). Gerekçe: smallint sadece API'nin sayısal döndüğü mevcut enum'lar için kullanılıyordu; bunlar yeni ve admin-facing.
- **Rapor aksiyonu atomik:** `PATCH /api/admin/reports/:id` `status=Actioned` ise opsiyonel yan-etki (içeriği sil / kullanıcıyı banla) **aynı transaction**'da; `reviewedByUserId` + `reviewedAt` yazılır.
- **Yetki ayrımı:** `POST /api/reports` normal kullanıcı (`JwtAuthGuard`, `@Throttle(write)`); `GET/PATCH /api/admin/reports` sadece `@Roles('Admin')`.
- **Spam koruması:** aynı (reporter, targetType, targetId) için tekrar rapor engellenir veya idempotent — unique index `(reporterUserId, targetType, targetId)`.

## API (yeni uçlar)

- `DELETE /api/admin/posts/:id`
- `DELETE /api/admin/comments/:id`
- `DELETE /api/admin/transfer-comments/:id`
- `GET    /api/admin/posts?user=&from=&to=&flagged=&q=&page=`     — moderasyon listesi
- `GET    /api/admin/comments?user=&from=&to=&flagged=&q=&page=`
- `POST   /api/reports`                 `{ targetType, targetId, reason, note? }`  (kullanıcı)
- `GET    /api/admin/reports?status=&page=`
- `PATCH  /api/admin/reports/:id`        `{ status, action?: { deleteContent?, banUser? } }`

## Modeller

```prisma
enum ReportTargetType { Post Comment TransferComment User }
enum ReportReason     { Spam Hate Harassment Other }
enum ReportStatus     { Pending Reviewed Actioned Dismissed }

model Report {
  id              String   @id @default(uuid())
  reporterUserId  String
  targetType      ReportTargetType
  targetId        String
  reason          ReportReason
  note            String?
  status          ReportStatus @default(Pending)
  reviewedByUserId String?
  reviewedAt      DateTime?
  createdAt       DateTime @default(now())
  @@unique([reporterUserId, targetType, targetId])
  @@index([status, createdAt])
  @@index([targetType, targetId])
}
```

## Dosya yapısı

```
prisma/schema.prisma                         # Report model + 3 enum
prisma/migrations/<ts>_add_report/
src/reports/
├─ reports.module.ts
├─ reports.controller.ts                      # POST /api/reports (kullanıcı)
├─ admin-reports.controller.ts                # GET/PATCH /api/admin/reports
├─ reports.service.ts                         # create + list + review(action transaction)
└─ dto/ create-report.dto.ts, review-report.dto.ts, report-list.query.dto.ts, report.response.dto.ts
src/posts/admin-posts.controller.ts           # DELETE + GET liste (moderasyon)
src/posts/posts.service.ts                    # adminDelete()
src/comments/admin-comments.controller.ts     # DELETE + GET liste
src/transfer-comments/...                      # adminDelete + DELETE uç
```

## Kurallar

- Admin delete: cascade FK'lere güven, manuel beğeni/oy silme yok.
- Rapor review aksiyonu transaction içinde (sil/ban + status + reviewedBy/At).
- `POST /api/reports`: kullanıcı kendi raporunu açar; hedef tipini/varlığını valide et; duplicate → idempotent/409.
- Tüm admin uçları `@Roles('Admin')` + write throttle.

## Test

- **E2E:** admin başka kullanıcının post'unu siler (owner değil) → 200; cascade ile yorum/beğeni gider.
- **E2E:** User rapor açar (201); User `/api/admin/reports`'a → 403; Admin işler → 200.
- **Unit:** review-action transaction (deleteContent + banUser birlikte), duplicate report.
- **Edge:** var olmayan target, geçersiz reason enum.

## Dependencies

- Yeni paket yok.

## Build order

1. Migration: `Report` + 3 enum + index.
2. Admin delete yolları (posts/comments/transfer-comments service `adminDelete` + controller'lar).
3. Moderasyon liste uçları (admin-posts/comments GET).
4. Reports module (create + admin list + review transaction) + DTO'lar.
5. Test (admin delete e2e, rapor akışı, yetki).
6. `pnpm tsc --noEmit && pnpm lint && pnpm test` + `openapi:gen` publish.
