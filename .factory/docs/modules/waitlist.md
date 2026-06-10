# waitlist

## Amaç

Landing page üzerinden anonim ziyaretçilerden e-posta toplamak ve uygulama
yayına çıktığında panelden tetiklenen tek seferlik bir **lansman duyuru**
e-postasını toplanan tüm abonelere **kuyruğa alıp batch/sıralı** göndermek.

Toplanan abonere kayıtlı kullanıcılar değildir (ayrı tablo). Lansman maili
yalnızca landing leadlere gider — kayıtlı kullanıcılar kapsam dışı.

## Kararlar (design turundan)

- **Hedef kitle:** sadece landing leadler (`WaitlistSubscriber`).
- **Toplama:** direkt kayıt (double opt-in yok) — e-posta bazında idempotent upsert.
- **Gönderim:** idempotent — her e-postaya bir kez. Tekrar tetiklenirse
  gönderilenler atlanır, yarıda kalırsa kaldığı yerden devam eder.

## API

| Method | Path | Auth | Açıklama |
|--------|------|------|----------|
| POST | `/api/waitlist` | Public, `@Throttle(ThrottlePolicies.write)` | E-posta topla (upsert, duplicate sessiz geçer) |
| POST | `/api/admin/waitlist/launch` | Admin, `@Throttle(adminBulk)`, `@Audit` | Lansman kampanyasını kuyruğa al → **202 Accepted** |
| GET | `/api/admin/waitlist/launches` | Admin | Kampanya geçmişi + durum (paged) |
| GET | `/api/admin/waitlist/stats` | Admin | toplam / abone / gönderilen / unsubscribe sayıları |

### Request/Response
- `POST /api/waitlist` → body `{ email: string; source?: string }`, response
  `{ data: { success: true } }`. Var olan e-posta tekrar gönderilirse 200, yeni
  kayıt yaratmaz (upsert).
- `POST /api/admin/waitlist/launch` → body `LaunchCampaignDto` (subject/title +
  body + opsiyonel ctaUrl). Response `{ data: LaunchCampaignResponseDto }`
  (id, status=`Queued`, total, sentCount=0).

## Modeller (Prisma — Postgres)

```prisma
model WaitlistSubscriber {
  id                String    @id @default(uuid()) @db.Uuid
  email             String    @unique @db.VarChar(255)
  source            String?   @db.VarChar(60)        // ör. "landing", "footer"
  status            String    @default("subscribed") @db.VarChar(20) // subscribed | unsubscribed | bounced
  launchEmailSentAt DateTime? @db.Timestamptz        // idempotency + resume anahtarı
  createdAt         DateTime  @default(now()) @db.Timestamptz

  @@index([status, launchEmailSentAt])
  @@map("waitlist_subscribers")
}

model LaunchCampaign {
  id        String   @id @default(uuid()) @db.Uuid
  subject   String   @db.VarChar(200)
  body      String   @db.VarChar(2000)
  status    String   @default("Queued") @db.VarChar(20) // Queued | Sending | Done | Failed
  total     Int      @default(0)
  sentCount Int      @default(0)
  createdBy String   @db.Uuid
  createdAt DateTime @default(now()) @db.Timestamptz

  @@index([createdAt])
  @@map("launch_campaigns")
}
```

Migration: `prisma/migrations/<ts>_add_waitlist/`.

## Dosya yapısı

```
src/waitlist/
├── waitlist.module.ts            # BullModule.registerQueue(LAUNCH_QUEUE) + EmailModule import
├── waitlist.controller.ts        # POST /api/waitlist  (Public)
├── waitlist.admin.controller.ts  # /api/admin/waitlist/*  (@Roles('Admin'))
├── waitlist.service.ts           # subscribe(upsert) + enqueueLaunch + history + stats
├── launch.processor.ts           # BullMQ worker: cursor-batch + sıralı send + idempotent
├── waitlist.constants.ts         # LAUNCH_QUEUE, LAUNCH_BATCH_SIZE, SEND_DELAY_MS
├── dto/
│   ├── create-waitlist.dto.ts        # email + source
│   ├── launch-campaign.dto.ts        # subject/body/ctaUrl
│   ├── launch-campaign.response.dto.ts
│   └── waitlist-stats.response.dto.ts
├── waitlist.service.spec.ts
└── launch.processor.spec.ts
```

## Kurallar / davranış

### Toplama (`subscribe`)
- E-posta `@IsEmail()` + `@MaxLength(255)` + `@Transform` ile lowercase/trim.
- `prisma.waitlistSubscriber.upsert({ where: { email }, create, update: {} })`
  — duplicate sessizce geçer, yeni kayıt yaratmaz, sayaç şişmez.
- `source` opsiyonel, `@MaxLength(60)`.

### Lansman gönderimi (`enqueueLaunch` + `launch.processor`)
1. `enqueueLaunch`: `LaunchCampaign` kaydı oluştur (status `Queued`,
   `total` = aktif abone sayısı), kuyruğa `{ campaignId }` job ekle
   (`attempts: 3, removeOnComplete: true`). Senkron gönderim YOK.
2. Processor (`broadcast.processor.ts` pattern'i):
   - Kampanyayı `Sending` yap.
   - Cursor ile `LAUNCH_BATCH_SIZE` (örn. 100) abone çek:
     `where: { status: 'subscribed', launchEmailSentAt: null }`,
     `orderBy: { id: 'asc' }`.
   - Her abone için `emailService.sendBroadcast(email, { title, body, ctaUrl })`
     ile **sıralı** gönder; Resend rate-limit'i için her gönderim arası
     `SEND_DELAY_MS` bekle (worker concurrency = 1).
   - Başarılı gönderimde `launchEmailSentAt = now()` yaz, `sentCount` artır.
   - Hata tek alıcıda ise logla + atla (toplu gönderim durmasın); yeniden
     deneme job seviyesinde (`attempts`) kaldığı yerden (sentAt null olanlar) devam.
   - Bitince status `Done` (hata yoksa) / `Failed`.
- **Idempotency:** `launchEmailSentAt IS NULL` filtresi tekrar tetiklemeyi ve
  resume'u tek başına garanti eder. Aynı kampanya yeniden tetiklenirse zaten
  gönderilenler atlanır.

### Opt-out / deliverability
- `dispatch()` zaten `List-Unsubscribe` (RFC 8058) header'ı ekliyor — leadlere
  de uygulanır.
- `EmailService.unsubscribe(token)` genişletilir: token'daki e-posta için
  `waitlistSubscriber.updateMany({ where: { email, status: 'subscribed' }, data: { status: 'unsubscribed' } })`
  de çağrılır (User tablosuna ek olarak). Böylece unsubscribe olan lead'e mail gitmez.

## Değişecek mevcut dosyalar
- `prisma/schema.prisma` → 2 yeni model + migration.
- `src/email/email.service.ts` → `unsubscribe()` lead desteği.
- `src/app.module.ts` → `WaitlistModule` register.
- `src/common/audit/audit-actions.ts` → `WaitlistLaunch: 'waitlist.launch'`.

## Test
- **Unit (service):** subscribe upsert (yeni + duplicate), enqueueLaunch
  (kampanya kaydı + queue.add çağrısı), stats.
- **Unit (processor):** batch döngüsü, idempotent atlama (sentAt dolu olanlar
  çekilmez), tek-alıcı hatasında devam, status geçişleri.
- **Edge:** geçersiz e-posta (400), 0 abone ile launch (Done, sentCount 0),
  unsubscribe sonrası gönderim atlanır.

## Dependencies
- Yok — `@nestjs/bullmq` + `bullmq`, `resend`, Prisma mevcut.

## Env variables
- Yok — Resend config (`resend.from`, asset/web URL) ve Redis (BullMQ) reuse.

## Build order
1. Prisma model (2 model) + migration (`/db migrate` veya `/migrate`)
2. DTO'lar
3. `waitlist.service.ts` (subscribe + enqueueLaunch) — unit test
4. `launch.processor.ts` (batch + idempotent send) — unit test
5. Controller'lar (public + admin)
6. `EmailService.unsubscribe` lead desteği + `app.module` register + audit action

## Kapsam dışı (not)
- Double opt-in / onay maili.
- Kayıtlı kullanıcılara lansman maili (mevcut `admin/broadcast` ayrı iş).
- Çoklu kampanya: `launchEmailSentAt` tek-seferlik lansman içindir. İleride
  farklı kampanyalar istenirse `CampaignDelivery(campaignId, subscriberId)`
  ara tablosuna geçilmeli.
