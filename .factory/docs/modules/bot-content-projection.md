# bot-content-projection

## Amaç

`POST /api/ingest/posts` ile gelen bot içeriği şu an yalnızca `Post` (akış / gönderi)
olarak kaydediliyor; **Transferler / Duyumlar / Haberler** sekmelerine düşmüyor.
Bu iş, ingest sırasında içeriği kategorisine göre ilgili tabloya da **yansıtır
(fan-out)**: söylenti → Duyum, resmi → Transfer, transfer-dışı → Haber. Hepsi
`Post` create ile aynı transaction'da, idempotent.

İlgili önceki spec: `bot-content-ingestion.md` (mevcut ingest akışı).

## Yönlendirme matrisi

`resolvePostShape(dto)` ile çıkan `postType` + bot `category` belirler:

| Post şekli (postType)                 | category   | Aksiyon                                                            |
|---------------------------------------|------------|-------------------------------------------------------------------|
| Transfer (1) — player+fromTeam+toTeam | `Rumour`   | Post + **Duyum** (`Transfer.isRumour=true`)                       |
| Transfer (1)                          | `Official` | Post + **Transfer** (`isRumour=false`); açık duyum varsa *confirm*|
| Transfer (1)                          | `Breaking` | Sadece Post (fan-out yok)                                          |
| Team (2)                              | herhangi   | Post + **News** (Haberler)                                        |
| Player (3)                            | herhangi   | Post + **News** (Haberler)                                        |

- Eşleştirme **metin parsing'i ile değil**, bot'un payload'da gönderdiği
  `playerId / fromTeamId / toTeamId / teamId` UUID'leriyle yapılır (mevcut davranış).
- `resolvePostShape` zaten geçersiz FK kombinasyonlarını 400 ile eler; projection
  yalnızca geçerli shape üzerinden çalışır.

### Dedup — Duyum → Resmi

`Official` geldiğinde aynı `(playerId, fromTeamId, toTeamId)` için **açık (isRumour=true,
isDeleted=false) bir duyum** varsa:
- yeni Transfer **oluşturulmaz**; mevcut duyum `confirmRumour(id, {feeAmount, feeCurrency,
  transferDate})` ile `isRumour=false`'a çevrilir (mevcut confirm akışı + notification).
Açık duyum yoksa:
- `existsDuplicate` kontrolünden sonra yeni Transfer oluşturulur.

## Şema değişiklikleri (migration)

`prisma/schema.prisma`:

- `Transfer.sourceId String? @unique @db.VarChar(64)` — bot tweet bağlantısı,
  ikincil idempotency + iz sürme. `@@index` gerekmez (unique zaten index).
- `News.sourceId String? @unique @db.VarChar(64)` — aynı.
- `enum TransferSource { Manual ApiSports Bot }` — `Bot` eklenir. Bot tarafından
  yaratılan transfer/duyumlar `source = Bot` (admin panelde ayırt etmek için).

`/db migrate` ile migration üretilir. Mevcut satırlar için `sourceId` null kalır (geriye uyumlu).

## DTO değişiklikleri

`src/ingestion/dto/ingest-post.dto.ts` — opsiyonel alanlar (yalnız Official için anlamlı):

```ts
@ApiPropertyOptional({ minimum: 0 })
@IsOptional() @Type(() => Number) @IsNumber() @Min(0)
feeAmount?: number;

@ApiPropertyOptional({ maxLength: 10, example: 'EUR' })
@IsOptional() @IsString() @MaxLength(10)
feeCurrency?: string;

@ApiPropertyOptional({ format: 'date-time' })
@IsOptional() @Type(() => Date) @IsDate()
transferDate?: Date;
```

`src/ingestion/dto/ingest-result.response.dto.ts` — sonuç genişler:

```ts
projectedAs?: 'rumour' | 'transfer' | 'news' | 'none';
transferId?: string; // rumour/transfer yansımasında
newsId?: string;     // news yansımasında
```

## Yeni dosyalar

### `src/ingestion/projection-target.resolver.ts`
Saf fonksiyon — yan etkisiz, kolay test edilir:

```ts
export type ProjectionTarget = 'rumour' | 'transfer' | 'news' | 'none';

export function resolveProjectionTarget(
  postType: number,          // PostType: 1 Transfer, 2 Team, 3 Player
  category: BotContentCategory, // 1 Rumour, 2 Breaking, 3 Official
): ProjectionTarget;
```

Matris:
- `postType=Transfer & category=Rumour`   → `'rumour'`
- `postType=Transfer & category=Official` → `'transfer'`
- `postType=Transfer & category=Breaking` → `'none'`
- `postType=Team | postType=Player`       → `'news'`

> `if/else` yerine küçük lookup; CLAUDE.md mimari disiplinine uygun (tek sorumluluk,
> branching dışarı alınmış, test edilebilir).

### `src/ingestion/ingest-projection.service.ts`
Fan-out orkestrasyonu. **Tx içinde** çalışır (Post create ile aynı transaction),
hedefe göre repo metodunu çağırır, notification outbox event'i emit eder:

```ts
@Injectable()
export class IngestProjectionService {
  // inject: TRANSFER_REPOSITORY, NEWS_REPOSITORY, OutboxService
  async project(
    tx: Prisma.TransactionClient,
    input: {
      postId: string;
      shape: ResolvedShape;
      category: BotContentCategory;
      dto: IngestPostDto;
      ownerId: string;
    },
  ): Promise<{ projectedAs: ProjectionTarget; transferId?: string; newsId?: string }>;
}
```

Davranış:
- `'rumour'` → `repo.createRumour({...feeAmount:dto.feeAmount??0, feeCurrency:dto.feeCurrency??'EUR',
  createdByUserId: ownerId, sourceId: dto.sourceId, source: Bot}, tx)` + notification enqueue.
- `'transfer'` → açık duyum varsa `confirmRumour`; yoksa `existsDuplicate` sonra
  `createTransfer({... transferDate: dto.transferDate ?? now(), feeAmount: dto.feeAmount??0,
  feeCurrency: dto.feeCurrency??'EUR', createdByUserId: ownerId, sourceId, source: Bot}, tx)`
  + notification enqueue.
- `'news'` → `newsRepo.createFromIngest({ title, slug, content: dto.text, publishDate: now(),
  playerId/fromTeamId/toTeamId: shape, imageUrl: dto.imageUrl, sourceName, sourceUrl: dto.sourceUrl,
  sourceId: dto.sourceId }, tx)`.
- `'none'` → no-op.

News türetme yardımcıları (servis içi private):
- `title` = bot metninden ilk satır / ~120 char'a kısaltma (max 500).
- `slug` = `slugify(title)` + `-` + `sourceId` kısa eki (unique garanti).
- `sourceName` = `sourceUrl` host'undan ya da sabit `'TransferPulse'`.

## Değişecek mevcut dosyalar

- `src/ingestion/ingestion.service.ts`
  - `post.create` + `projection.project(tx, ...)` **tek `prisma.$transaction`** içinde.
  - Başarılı fan-out sonrası `cache.invalidateTags(CacheTag.Transfers)` (news için ilgili tag varsa o da).
  - Audit metadata'ya `projectedAs`, `transferId`/`newsId` eklenir.
  - Result DTO genişler.
  - Mevcut idempotency korunur: post `sourceId` zaten varsa erken `duplicate` döner, fan-out hiç çalışmaz.
- `src/ingestion/ingestion.module.ts`
  - `IngestProjectionService` provider; `TRANSFER_REPOSITORY`, `NEWS_REPOSITORY`,
    `OutboxService`, `CacheService` erişimi (gerekli modüllerin export/import düzeni).
- `src/transfers/transfer.repository.ts` (+ `prisma-transfer.repository.ts`)
  - `findOpenRumour(playerId, fromTeamId, toTeamId): Promise<{ id: string } | null>`
    (isRumour=true, isDeleted=false).
  - `RumourWriteInput` / `TransferWriteInput` → opsiyonel `sourceId?: string`,
    `source?: TransferSource` alanları; create metotları bunları yazar.
- `src/news/news.repository.ts` (+ `prisma-news.repository.ts`)
  - `createFromIngest(data, tx?)` — `sourceId` ile, tx-aware create.

## Kurallar / kenar durumlar

- Tüm fan-out Post create ile **atomik** — biri yazılırsa hepsi (transaction).
- Idempotency birincil olarak Post `sourceId` unique ile; Transfer/News `sourceId`
  unique ikincil koruma (yarış / kısmi tekrar).
- `Breaking` transfer-shaped içerik yalnız feed'de kalır (kullanıcı kararı).
- `Team`/`Player` shaped içerik kategoriden bağımsız News olur.
- Bot'tan gelen UUID'ler katalogda yoksa Prisma `P2003` → mevcut `mapWriteError`
  ile 404 ('Oyuncu veya takım bulunamadı'); ingest reddedilir (kısmi yazma olmaz).

## Env

Yeni env değişkeni yok.

## Build sırası

1. `prisma/schema.prisma`: `Transfer.sourceId`, `News.sourceId`, `TransferSource.Bot` → `/db migrate`
2. Repo metotları: `findOpenRumour`, write input `sourceId`/`source`, `news.createFromIngest`
3. `projection-target.resolver.ts` (+ spec)
4. `ingest-projection.service.ts` (+ spec)
5. `ingestion.service.ts` (transaction + fan-out + cache + audit), DTO + result DTO
6. `ingestion.module.ts` wiring
7. Integration test: ingest → Post + ilgili tablo + idempotency

## Test

- **Unit — resolver:** her (postType × category) kombinasyonu doğru target.
- **Unit — projection service:**
  - rumour create + notification enqueue çağrıldı
  - official: açık duyum varsa `confirmRumour` (yeni transfer yok), yoksa `createTransfer`
  - breaking transfer → no-op
  - team/player → news, title/slug türetme doğru
- **Integration (testcontainers):**
  - `Rumour` ingest → 1 Post + 1 Transfer(isRumour=true)
  - `Official` ingest → 1 Post + 1 Transfer(isRumour=false), `source=Bot`
  - önce `Rumour` sonra aynı üçlü `Official` → tek Transfer (confirm, duplicate yok)
  - `Breaking` transfer → 1 Post, 0 Transfer
  - team-shaped → 1 Post + 1 News
  - aynı `sourceId` iki kez → tek Post + tek yansıma (idempotent)
