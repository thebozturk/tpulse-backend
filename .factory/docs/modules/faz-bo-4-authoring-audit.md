# faz-bo-4-authoring-audit

> TransferPulse Back Office — Faz BO-4. Kaynak: `docs/backoffice/BACKOFFICE-BACKEND-ROADMAP.md` (Faz BO-4).
> **Branch:** `feature/faz-bo-4-authoring-audit` · **Tahmin:** ~3 gün
> **Bağımlılık:** BO-2/BO-3 (loglanacak admin aksiyonları orada doğar).

## Amaç

Mevcut yazma uçlarını (transfer/duyum/haber/oyuncu/takım/lig) BO ihtiyacına göre uçtan uca doğrula + tüm kritik admin aksiyonları için **audit log** kur.

## Alınan teknik kararlar

- **Audit yazımı — hibrit: interceptor + explicit servis çağrısı.**
  - Genel CUD aksiyonları için `@Audit('action.name')` decorator + **interceptor** (otomatik, actor/target/metadata yakalar). Tekrarı azaltır.
  - Çok aşamalı/koşullu aksiyonlar (ör. report-action: sil+ban birlikte) için **explicit** `AuditService.log(...)` — doğru metadata garanti.
  - **Gerekçe:** saf interceptor zengin domain metadata'sını kaçırır; saf explicit her yerde tekrar ister. Hibrit büyük sistemlerde standart.
- **Yazım fire-and-forget değil ama bloklamasın:** audit yazımı asıl işlemden sonra; hata audit'i loglar, asıl response'u düşürmez (audit yazımı başarısızsa warn-log, 500 atma). Kritik denetim gerekiyorsa ileride aynı transaction'a alınabilir.
- **Model — yeni `AuditLog`** (Prisma). `metadata` JSON (`Json` tipi). `action` serbest string ama sabit katalog (`src/common/audit/audit-actions.ts` enum/const — magic string yasağı).
- **`actorUserId` nullable değil** (sistem aksiyonları için ileride `system` sentinel düşünülebilir; şimdilik admin aksiyonları → her zaman actor var).

## API (yeni uçlar)

- `GET /api/admin/audit-logs?actor=&action=&from=&to=&page=` — paged.

## Modeller

```prisma
model AuditLog {
  id          String   @id @default(uuid())
  actorUserId String
  action      String                 // bkz. audit-actions katalog
  targetType  String?
  targetId    String?
  metadata    Json?
  createdAt   DateTime @default(now())
  @@index([actorUserId, createdAt])
  @@index([action, createdAt])
}
```

## Dosya yapısı

```
prisma/schema.prisma                       # AuditLog
prisma/migrations/<ts>_add_audit_log/
src/common/audit/
├─ audit.module.ts
├─ audit.service.ts                         # log() — non-blocking, warn on failure
├─ audit.interceptor.ts                     # @Audit decorator yakalar
├─ audit.decorator.ts                       # @Audit('user.ban')
└─ audit-actions.ts                         # action katalog (const) — magic string yok
src/admin/audit/
├─ audit-logs.controller.ts                 # GET /api/admin/audit-logs
└─ dto/ audit-log-list.query.dto.ts, audit-log.response.dto.ts
```

## Kurallar

- BO-2 (status/role/reputation), BO-3 (delete/report-action) aksiyonlarına audit eklenir (decorator veya explicit).
- Audit yazımı asıl işlemi bloklamaz/başarısız etmez.
- `action` sadece katalogdan; controller `@Roles('Admin')`.
- Mevcut authoring uçları: BO ile uçtan uca test, eksik response/validation tamamlanır; rumour-confirm akışı gözden geçirilir (kod yazımı sadece eksik varsa).

## Test

- **Unit:** kritik aksiyonlar (ban, post.delete, report.action) audit kaydı üretir.
- **Unit:** audit yazımı başarısız olursa asıl işlem yine başarılı (non-blocking).
- **E2E:** `GET /api/admin/audit-logs` filtre (actor/action/range).

## Dependencies

- Yeni paket yok (Nest interceptor + Prisma Json).

## Build order

1. Migration: `AuditLog`.
2. audit-actions katalog + AuditService (non-blocking) + AuditModule.
3. `@Audit` decorator + interceptor.
4. BO-2/BO-3 aksiyonlarına audit bağla (decorator/explicit).
5. audit-logs.controller (GET liste).
6. Mevcut authoring uçları uçtan uca test + eksik validation/response.
7. `pnpm tsc --noEmit && pnpm lint && pnpm test` + `openapi:gen` publish.
