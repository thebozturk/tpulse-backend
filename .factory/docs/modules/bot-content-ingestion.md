# bot-content-ingestion

> TransferPulse bot içerik ingestion'ı. Bot (haber çeken + onaylı tweet atan)
> aynı içeriği uygulama akışına otomatik ekler: duyum/son dakika/resmi kategorili,
> TransferPulse sistem kullanıcısı adına Post olarak.

## Amaç

Botun API key ile kimliklenip, serbest-metin (+opsiyonel oyuncu/takım) içerikleri
uygulamanın sosyal akışına (Post) güvenli ve idempotent şekilde enjekte etmesi.

## Alınan teknik kararlar

- **Kimlik — API key (servis-to-servis), JWT değil.**
  - Bot `X-Api-Key: <secret>` gönderir.
  - Secret **düz saklanmaz**: `BOT_API_KEY_HASH` (SHA-256 hex) env'de tutulur.
  - `ApiKeyGuard` gelen key'in SHA-256'sını `crypto.timingSafeEqual` ile karşılaştırır
    (constant-time; timing attack'a kapalı). Hash yoksa/eşleşmezse 401 (fail-closed).
  - Guard yalnız ingestion ucuna; global JwtAuthGuard `@Public()` ile bypass edilir.
- **Hedef model — Post (sistem kullanıcısı "TransferPulse" adına).** Sosyal akışta görünür.
  - Post'a yeni alanlar: `category` (smallint), `sourceId` (tweet id, **@unique**),
    `sourceUrl`, `imageUrl`.
- **Kategori — smallint const enum (proje konvansiyonu):** `BotContentCategory`
  `Rumour=1, Breaking=2, Official=3` (duyum / son dakika / resmi).
- **Varlık bağlama — opsiyonel; DB check constraint'e uyumlu shape resolver.**
  `post_type_shape_chk`: dört FK NULL → her postType serbest (serbest metin);
  yalnız playerId → postType=3; yalnız teamId → postType=2; player+from+to → postType=1;
  diğer kısmi kombinasyonlar → 400.
- **Idempotency — `sourceId` @unique.** Aynı tweet tekrar gelirse yeni kayıt açılmaz
  → `{ status: 'duplicate' }`. Bot retry'da çift içerik olmaz. (Normal kullanıcı
  post'larında `sourceId` NULL — Postgres çoklu NULL'a izin verir, etkilenmez.)
- **Sistem kullanıcısı — lazy ensure.** `username='transferpulse'` yoksa oluşturulur
  (nickname 'TransferPulse', role 'User', status Active, rastgele passwordHash → login yok).
- **Audit — explicit.** Her ingest `AuditService.log('bot.ingest', metadata:{sourceId,category})`.
- **Rate limit + opsiyonel HMAC (faz-2):** ingest ucu throttle'lı; kanal riski olursa
  HMAC imza + timestamp penceresi eklenebilir (bu fazda kapsam dışı).

## API

- `POST /api/ingest/posts` — `X-Api-Key` ile. Gövde:
  ```jsonc
  {
    "category": "Rumour|Breaking|Official",
    "text": "tweet metni",
    "sourceId": "tweet-id-123",        // idempotency anahtarı
    "sourceUrl": "https://x.com/...",  // ops.
    "imageUrl": "https://...jpg",      // ops.
    "playerId": "uuid",                // ops.
    "teamId": "uuid",                  // ops.
    "fromTeamId": "uuid",              // ops.
    "toTeamId": "uuid"                 // ops.
  }
  ```
  → `201 { data: { id, status: 'created'|'duplicate' } }`

## Modeller

- `Post` (değişiklik): `category Int? @db.SmallInt`, `sourceId String? @unique @db.VarChar(64)`,
  `sourceUrl String? @db.VarChar(500)`, `imageUrl String? @db.VarChar(500)`.

## Dosya yapısı

```
prisma/schema.prisma + migration bot_ingestion_fields
src/common/enums/bot-content-category.enum.ts
src/common/guards/api-key.guard.ts
src/config/* (BOT_API_KEY_HASH: env.validation + configuration)
src/ingestion/
├─ ingestion.module.ts
├─ ingest.controller.ts            # POST /api/ingest/posts (@Public + ApiKeyGuard)
├─ ingestion.service.ts            # systemUser + shape resolve + dedupe + create + audit
├─ post-shape.resolver.ts          # category/entity → {postType, fkler} (constraint-safe)
└─ dto/ ingest-post.dto.ts, ingest-result.response.dto.ts
src/posts/post-response.dto.ts + post.mapper.ts  # category/imageUrl/sourceUrl feed'e
src/common/audit/audit-actions.ts  # +BotIngest
```

## Kurallar

- ApiKeyGuard fail-closed; key hash env'den, constant-time compare.
- Shape resolver DB constraint'i birebir yansıtır (geçersiz kısmi kombinasyon → 400).
- sourceId unique → idempotent.
- Sistem kullanıcısı tek sefer ensure edilir (cache'lenebilir).

## Test

- Unit: ApiKeyGuard (doğru/yanlış/eksik key), shape resolver (5 kombinasyon),
  ingestion.service (create, duplicate, invalid shape, audit çağrısı).
- E2E: key olmadan 401; geçerli key + payload → 201 created; tekrar → duplicate.

## Build order

1. Enum + schema/migration (Post alanları).
2. Config (BOT_API_KEY_HASH) + .env.example.
3. ApiKeyGuard.
4. Shape resolver + ingestion.service + DTO'lar + controller + module.
5. Post response/mapper'a category/imageUrl/sourceUrl.
6. Audit action + bağlama.
7. Test + route-parity ALLOWED_EXTRA.
8. Bot projesi için entegrasyon dokümanı.
