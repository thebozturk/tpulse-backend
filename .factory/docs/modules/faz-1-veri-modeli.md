# faz-1-veri-modeli

> TransferPulse Faz 1. Kaynak: `docs/01-DATA-MODEL.md` (tam Prisma şema referansı), `docs/06` Faz 1 kriterleri.

## Amaç

`docs/01`'deki 25 entity + 6 enum'u `schema.prisma`'ya dök, ilk migration'ı oluştur (greenfield), `pg_trgm` extension + check constraint'leri migration SQL'ine ekle, Transfer soft-delete'i Prisma Client Extension ile uygula.

## Alınan teknik kararlar

- **Enum stratejisi — hibrit (docs):**
  - smallint saklanan 5 enum → `Int @db.SmallInt` kolon + TS const enum: `PostType`, `PostVoteChoice`, `FavouriteType`, `NotificationEventType`, `SyncRunStatus`.
  - string saklanan 2 enum → Prisma **native enum**: `UserStatus` (Active/Inactive/Banned/Suspended), `TransferSource` (Manual/ApiSports).
  - Gerekçe: API response'ları enum'ları **sayısal** döner (`postType:1`, `choice:2`) — Int kolon birebir eşler, map katmanı gerekmez.
- **Soft-delete (Transfer.isDeleted):** Prisma **Client Extension** — Transfer okuma sorgularına otomatik `where:{isDeleted:false}` enjekte; `delete`→`update({isDeleted:true})`. Merkezi, unutma riski yok.
- **Check constraint'ler:** Prisma şemada ifade edilemeyenler ilk migration SQL'ine elle eklenir (Post FK-shape, PostVote choice IN(1,2), TransferPeriod endDate≥startDate). DTO validation ile birlikte (defense-in-depth).
- **pg_trgm:** ilk migration'da `CREATE EXTENSION IF NOT EXISTS pg_trgm` (Faz 3 search için).
- **Greenfield:** mevcut DB yok; `migrate dev` sıfırdan tablo yaratır. `@@map`/`@map` tablo-kolon adları docs/01 ile tutulur (ileride .NET DB attach edilebilsin diye, zararsız).

## Dosya yapısı

```
prisma/
├─ schema.prisma                 # 25 model + 2 native enum (datasource/generator zaten var)
└─ migrations/                   # migrate dev çıktısı
   └─ <ts>_init/migration.sql    # + pg_trgm + check constraints (elle eklenecek SQL)
src/common/
├─ enums/                        # smallint enum'ların TS const karşılıkları
│  ├─ post-type.enum.ts          # Transfer=1, Team=2, Player=3
│  ├─ post-vote-choice.enum.ts   # Disagree=1, Agree=2
│  ├─ favourite-type.enum.ts     # League=1, Team=2, Player=3, Reporter=4
│  ├─ notification-event-type.enum.ts # Rumour=1, Transfer=2
│  ├─ sync-run-status.enum.ts    # Success=0, Partial=1, Failed=2
│  └─ index.ts                   # re-export (UserStatus/TransferSource Prisma'dan gelir)
└─ prisma/
   ├─ soft-delete.extension.ts   # Transfer read-filter + delete→update extension
   ├─ prisma.service.ts          # (mevcut) base client, $connect lifecycle
   ├─ extended-prisma.ts         # EXTENDED_PRISMA token + factory (prisma.$extends(softDelete))
   └─ prisma.module.ts           # PrismaService + EXTENDED_PRISMA provider export
```

## Enum saklama tablosu (docs/01 §Enum'lar)

| Enum | Saklama | Prisma | Değerler |
|---|---|---|---|
| UserStatus | string | native enum | Active, Inactive, Banned, Suspended |
| TransferSource | string | native enum | Manual, ApiSports |
| PostType | smallint | Int + TS enum | Transfer=1, Team=2, Player=3 |
| PostVoteChoice | smallint | Int + TS enum | Disagree=1, Agree=2 |
| FavouriteType | smallint | Int + TS enum | League=1, Team=2, Player=3, Reporter=4 |
| NotificationEventType | smallint | Int + TS enum | Rumour=1, Transfer=2 |
| SyncRunStatus | smallint | Int + TS enum | Success=0, Partial=1, Failed=2 |

## Modeller (25) — docs/01 §Prisma Schema birebir

User, League, Team, Position, Player, Transfer, Post, PostLike, PostVote, Comment, CommentLike, TransferComment, TransferCommentLike, News (`@map("news_id")` PK), CurrencyRate, Notification, NotificationPreference, PasswordResetToken, RefreshToken, OutboxMessage, SyncRun, UserFavourite, TransferPeriod.

Kritik index/unique'ler (docs/01):
- Transfer: `@@index([playerId, fromTeamId, toTeamId, transferDate])` (dedup), `transferDate`, `feeAmount`
- Notification: `@@unique([userId, transferId, eventType])` (dedup), `@@index([userId, createdAt])`
- NotificationPreference: `@@unique([userId, eventType])`
- UserFavourite: `@@unique([userId, type, targetId])`
- Post: `@@index([createdAtUtc, id])` (feed)
- *Like/*Vote: `@@unique([postId,userId])` vb.
- CurrencyRate: `@@unique([currencyCode, baseCurrencyCode, rateDate])`

## Migration SQL eklentileri (elle, init migration.sql sonuna)

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Post: PostType'a göre FK doluluk (docs/01 check constraint)
ALTER TABLE "post" ADD CONSTRAINT "post_type_shape_chk" CHECK (
  (post_type=1 AND player_id IS NOT NULL AND from_team_id IS NOT NULL AND to_team_id IS NOT NULL AND team_id IS NULL) OR
  (post_type=2 AND team_id IS NOT NULL AND player_id IS NULL AND from_team_id IS NULL AND to_team_id IS NULL) OR
  (post_type=3 AND player_id IS NOT NULL AND team_id IS NULL AND from_team_id IS NULL AND to_team_id IS NULL) OR
  (player_id IS NULL AND team_id IS NULL AND from_team_id IS NULL AND to_team_id IS NULL)
);

ALTER TABLE "post_vote" ADD CONSTRAINT "post_vote_choice_chk" CHECK (choice IN (1,2));
ALTER TABLE "transfer_periods" ADD CONSTRAINT "transfer_period_dates_chk" CHECK (end_date >= start_date);
```
> Gerçek kolon adlarını migration.sql üretildikten SONRA teyit et (Prisma snake_case map'ler); ADD CONSTRAINT'i ona göre yaz.

## Soft-delete extension (Prisma Client Extension)

`prisma.$extends({ query: { transfer: { ... } } })`:
- `findMany`, `findFirst`, `count`, `aggregate`, `groupBy`, `updateMany`, `deleteMany` → args.where'e `isDeleted:false` enjekte (zaten varsa ezme).
- `delete` → `update({ data:{ isDeleted:true } })` (hard delete yapma).
- `findUnique` → Prisma unique-where'e ek filtre kabul etmez; servis katmanı sonucu `isDeleted` ile kontrol eder VEYA `findFirst`'e çevrilir.
- Bypass gerekiyorsa (admin hard-list) base `PrismaService` doğrudan kullanılır.

Connection paylaşımı: `EXTENDED_PRISMA` provider'ı `PrismaService`'i `$extends` eder (aynı bağlantı havuzu). Servisler `@Inject(EXTENDED_PRISMA) prisma: ExtendedPrismaClient` enjekte eder; lifecycle base `PrismaService`'te.

## Paketler

Yeni paket yok (Prisma 6 zaten kurulu). `prisma migrate dev` migration + client generate yapar.

## Doğrulama (docs/06 Faz 1)

- [ ] `pnpm prisma validate` temiz.
- [ ] `pnpm prisma migrate dev --name init` → tablolar oluşur, client generate olur.
- [ ] `pnpm prisma migrate status` temiz.
- [ ] Migration SQL'inde `pg_trgm` + 3 check constraint var.
- [ ] Read smoke: `prisma.user.count()` (=0) ve `prisma.$queryRaw SELECT 1` çalışır (docker infra ile).
- [ ] Soft-delete extension unit testi: Transfer.findMany çağrısı where.isDeleted=false ekliyor; delete → update'e dönüyor.
- [ ] `tsc --noEmit` + `lint` temiz.

## Build sırası

1. TS const enum'lar (`src/common/enums/`).
2. `schema.prisma` — 2 native enum + 25 model (docs/01 referansı).
3. `prisma validate` → `prisma migrate dev --name init`.
4. migration.sql'e pg_trgm + check constraint SQL ekle → migration'ı uygula/re-apply.
5. soft-delete.extension + extended-prisma provider + prisma.module güncelle.
6. Unit test (soft-delete extension davranışı) + read smoke.
7. tsc + lint + commit.

## Sonraki faz

Faz 2 — Auth & Users: AuthModule (register/login/refresh/logout/google/şifre sıfırlama), gerçek JwtStrategy + guard'lar, UsersModule (Admin CRUD).
