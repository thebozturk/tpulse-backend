# TransferPulse — Veri Modeli & Prisma Schema (01)

> Kaynak: `TransferPulse.Domain/Entities`, `TransferPulse.Domain/Enums`, `TransferPulse.Infrastructure/Persistence/Configurations` (EF Core). Bu doküman, mevcut PostgreSQL şemasını **birebir** tanımlar ve Prisma karşılıklarını verir. **Tablo ve kolon adları korunmalı** ki mevcut veri yeni backend ile çalışsın.

> **Başlangıç ipucu:** Prod/dev DB ayaktaysa `npx prisma db pull` ile mevcut şemayı çek, sonra bu dokümanla karşılaştırıp enum/ilişki/isimlendirmeyi düzelt. Sıfırdan migration üretmek yerine var olan şemaya eşle.

## Genel Tip Eşlemeleri

- `Guid` → `uuid` (Prisma `String @db.Uuid` / `@default(uuid())`)
- `DateTime` → `timestamptz` (her zaman **UTC** — `SaveChangesAsync` override'ı UTC'ye çevirir)
- `DateOnly` → `date` (Prisma `DateTime @db.Date`)
- `string` → `varchar(N)` (uzunluk varsa) veya `text`
- `decimal(p,s)` → `Decimal @db.Decimal(p,s)`
- `short` → `smallint` · `int` → `integer` · `bool` → `boolean`
- Enum'lar EF'te `HasConversion<string>()` veya `HasConversion<short>()` ile saklanır — Prisma'da **native enum** kullan, ama saklanan değerin (string adı veya küçük tam sayı) **mevcut DB ile aynı** olduğundan emin ol.

---

## Enum'lar

```csharp
UserStatus            { Active=0, Inactive=1, Banned=2, Suspended=3 }   // string olarak saklanır ("Active")
PostType              { Transfer=1, Team=2, Player=3 }                  // short olarak saklanır
PostVoteChoice        { Disagree=1, Agree=2 }                           // short
FavouriteType         { League=1, Team=2, Player=3, Reporter=4 }        // short
NotificationEventType { Rumour=1, Transfer=2 }                          // short
TransferSource        { Manual=0, ApiSports=1 }                         // string ("Manual")
SyncRunStatus         { Success=0, Partial=1, Failed=2 }                // short
```

> Prisma native enum kullanırken: string-saklanan enum'lar (`UserStatus`, `TransferSource`) için enum value adları aynen DB'deki string ile eşleşmeli. Short-saklanan enum'lar için Prisma native enum yerine `Int` kolon + uygulama katmanı enum'u kullanmak en güvenlisidir (mevcut DB'de küçük tam sayı saklanıyor).

---

## BaseEntity

Bazı entity'ler `BaseEntity`'den türer:
```
BaseEntity (abstract)
  Id: Guid (PK)
  CreatedAt: DateTime (UTC, default now)
  UpdatedAt: DateTime?  (nullable)
```
> Dikkat: Tüm entity'ler türemez. Aşağıda her entity'nin alanları **tam** verilmiştir (BaseEntity dahil edilmiş gibi düşünme; listeye bak).

---

## Entity Referansı

### User — tablo `users`
| Alan | Tip | Null | Not |
|---|---|---|---|
| Id | Guid | H | PK |
| Username | string(50) | H | unique |
| Email | string(256) | H | unique |
| PasswordHash | string | H | |
| Nickname | string(50) | H | |
| ProfilePic | string(500) | E | |
| IsMailConfirm | bool | H | default false |
| Status | UserStatus | H | string saklanır, default Active |
| FavouriteTeam | string(100) | E | |
| ReputationScore | int | H | default 0 |
| Role | string(20) | H | default "User" |
| GoogleId | string(256) | E | |
| CreatedAt | DateTime | H | default now |
| UpdatedAt | DateTime | E | |

Index: `Email` (unique), `Username` (unique). İlişkiler: 1:N RefreshToken, Transfer (CreatedBy), Post, PostLike, PostVote, Comment, CommentLike, TransferComment, TransferCommentLike. (Notification / NotificationPreference / UserFavourite / PasswordResetToken → UserId referansı var ama FK tanımlı **değil**.)

### League — tablo `league`
| Alan | Tip | Null | Not |
|---|---|---|---|
| Id | Guid | H | PK |
| ExternalId | int | E | unique (null-filtreli) — API-Football lig id |
| Name | string(30) | H | |
| Country | string(30) | H | |
| CountryLogo | string | H | |
| LeagueLogo | string | H | |
| LogoLockedByAdmin | bool | H | default false |
| LeagueLogoSourceUrl | string | E | değişiklik tespiti için orijinal URL |
| LeagueCode | string(10) | E | unique ("PL","LL","SA"...) |

Index: `ExternalId` (unique), `LeagueCode` (unique). İlişki: 1:N Team (DELETE RESTRICT).

### Team — tablo `team`
| Alan | Tip | Null | Not |
|---|---|---|---|
| Id | Guid | H | PK |
| ExternalId | int | E | unique (null-filtreli) |
| Name | string(50) | H | unique |
| Logo | string | E | |
| LogoLockedByAdmin | bool | H | default false |
| LogoSourceUrl | string | E | |
| Founded | int | E | |
| VenueName | string(100) | E | |
| VenueCity | string(100) | E | |
| VenueCapacity | int | E | |
| LeagueId | Guid | H | FK → League (RESTRICT) |

Index: `ExternalId` (unique), `Name` (unique). İlişkiler: N:1 League; 1:N Player; 1:N Transfer (Incoming=ToTeamId, Outgoing=FromTeamId); Post/News FK'leri (FromTeam/ToTeam, SET NULL).

### Position — tablo `position`
| Alan | Tip | Null | Not |
|---|---|---|---|
| Id | Guid | H | PK |
| CodeEn | string(5) | H | "GK","CB" |
| NameEn | string(16) | H | |
| CodeTr | string(5) | H | |
| NameTr | string(16) | H | |

İlişki: 1:N Player (DELETE SET NULL).

### Player — tablo `player`
| Alan | Tip | Null | Not |
|---|---|---|---|
| Id | Guid | H | PK |
| ExternalId | int | E | unique (null-filtreli) |
| FirstName | string(32) | H | |
| LastName | string(32) | H | |
| FullName | computed | H | read-only `FirstName + " " + LastName` (saklanmaz) |
| Nationality | string(32) | H | |
| BirthDate | DateOnly | E | |
| Height | short | E | cm |
| Weight | short | E | kg |
| Photo | string | E | R2 mirror URL |
| BirthPlace | string(32) | E | |
| BirthCountry | string(32) | E | |
| IsFree | bool | H | default false (free agent) |
| PhotoLockedByAdmin | bool | H | default false |
| PhotoSourceUrl | string | E | upstream foto URL |
| TeamId | Guid | H | FK → Team (RESTRICT) |
| PositionId | Guid | E | FK → Position (SET NULL) |

Index: `ExternalId` (unique). İlişkiler: N:1 Team, N:1 Position, 1:N Transfer.

### Transfer — tablo `transfers` (BaseEntity DEĞİL — kendi tarih alanları)
| Alan | Tip | Null | Not |
|---|---|---|---|
| Id | Guid | H | PK |
| PlayerId | Guid | H | FK → Player (RESTRICT) |
| FromTeamId | Guid | H | FK → Team (RESTRICT) |
| ToTeamId | Guid | H | FK → Team (RESTRICT) |
| TransferDate | DateTime | H | UTC |
| FeeAmount | decimal(18,2) | H | |
| FeeCurrency | string(10) | H | "EUR" |
| CreatedByUserId | Guid | E | FK → User (SET NULL) |
| IsRumour | bool | H | default false |
| IsDeleted | bool | H | default false (**soft delete** — global filter) |
| Source | TransferSource | H | string saklanır, default Manual |
| CreatedAt | DateTime | H | default now — **mobil kart zamanı budur** |
| UpdatedAt | DateTime | E | |

Index: `(PlayerId, FromTeamId, ToTeamId, TransferDate)` (dedup için kullanılır), `TransferDate`, `FeeAmount`. Global query filter: `is_deleted = false`. İlişki: 1:N TransferComment (CASCADE).

> **Rumour = Transfer with `IsRumour=true`**. Ayrı tablo yok. Rumour endpoint'leri `IsRumour=true` satırlarla çalışır; transfer endpoint'leri `IsRumour=false`.

### Post — tablo `post`
| Alan | Tip | Null | Not |
|---|---|---|---|
| Id | Guid | H | PK |
| OwnerId | Guid | H | FK → User (CASCADE) |
| Content | string | H | |
| PostType | PostType(short) | H | 1=Transfer,2=Team,3=Player |
| PlayerId | Guid | E | FK → Player (SET NULL) |
| TeamId | Guid | E | FK → Team (SET NULL) |
| FromTeamId | Guid | E | FK → Team (SET NULL) |
| ToTeamId | Guid | E | FK → Team (SET NULL) |
| LikeCount | short | H | denormalize |
| IsVotingEnabled | bool | H | default false |
| AgreeCount | int | H | default 0 |
| DisagreeCount | int | H | default 0 |
| CommentCount | int | H | default 0 |
| CreatedAtUtc | DateTime | H | default now |

**Check constraint** (PostType'a göre FK doluluk kuralı):
```
(post_type=1 AND player,from_team,to_team NOT NULL AND team NULL) OR
(post_type=2 AND team NOT NULL AND diğerleri NULL) OR
(post_type=3 AND player NOT NULL AND diğerleri NULL) OR
(hepsi NULL)
```
Index: `(CreatedAtUtc DESC, Id DESC)` (feed). İlişkiler: N:1 User/Player/Team/FromTeam/ToTeam; 1:N Comment (CASCADE), PostLike, PostVote.

### PostLike — tablo `post_like`
Id, PostId(FK CASCADE), UserId(FK CASCADE), CreatedAtUtc. Unique: `(PostId, UserId)`.

### PostVote — tablo `post_vote`
Id, PostId(FK CASCADE), UserId(FK CASCADE), Choice(PostVoteChoice short, check IN(1,2)), CreatedAtUtc. Unique: `(PostId, UserId)`.

### Comment — tablo `comment`
Id, OwnerId(FK User CASCADE), Content(string?), PostId(FK CASCADE), ParentId(self-ref FK CASCADE), LikeCount(short), CreatedAtUtc. İlişki: self-ref Replies; 1:N CommentLike.

### CommentLike — tablo `comment_like`
Id, CommentId(FK CASCADE), UserId(FK CASCADE), CreatedAtUtc. Unique: `(CommentId, UserId)`.

### TransferComment — tablo `transfer_comment`
Id, TransferId(FK CASCADE), OwnerId(FK User CASCADE), Content(string?), ParentId(self-ref CASCADE), LikeCount(short), CreatedAtUtc. İlişki: self-ref Replies; 1:N TransferCommentLike.

### TransferCommentLike — tablo `transfer_comment_like`
Id, TransferCommentId(FK CASCADE), UserId(FK CASCADE), CreatedAtUtc. Unique: `(TransferCommentId, UserId)`.

### News — tablo `news` (PK adı `NewsId`)
| Alan | Tip | Null | Not |
|---|---|---|---|
| NewsId | Guid | H | PK |
| PublishDate | DateTime | H | default now |
| PlayerId | Guid | E | FK → Player (SET NULL) |
| FromTeamId | Guid | E | FK → Team (SET NULL) |
| ToTeamId | Guid | E | FK → Team (SET NULL) |
| Slug | string(256) | H | |
| ImageUrl | string | E | |
| SourceName | string(128) | E | |
| SourceUrl | string | E | |
| Title | string | H | |
| Content | string | E | |

Index: `PlayerId`, `ToTeamId`, `FromTeamId`, `SourceName`, `PublishDate`.

### CurrencyRate — tablo `currency_rates`
Id, CurrencyCode(string(10)), BaseCurrencyCode(string(10)), Rate(decimal(18,8)), RateDate(DateTime), CreatedAt. Unique: `(CurrencyCode, BaseCurrencyCode, RateDate)`. Index: `RateDate`. (Para birimi çevrimi / dashboard için.)

### Notification — tablo `notification`
Id, UserId, EventType(NotificationEventType), Title(string(200)), Body(string(500)), TransferId(Guid? — deep link & dedup), IsRead(bool default false), CreatedAt. Index: `(UserId, CreatedAt)`. **Unique: `(UserId, TransferId, EventType)`** (dedup). FK tanımlı değil (referans).

### NotificationPreference — tablo `notification_preference`
Id, UserId, EventType(NotificationEventType), Enabled(bool default true). Unique: `(UserId, EventType)`. **Opt-out modeli:** satır yoksa açık kabul edilir.

### PasswordResetToken — tablo `password_reset_token`
Id, UserId, TokenHash(string(128) — SHA-256; ham token sadece e-postada), ExpiresAt, UsedAt(DateTime?), CreatedAt, IsActive(computed: `UsedAt==null && ExpiresAt>now`). Index: `TokenHash`, `UserId`.

### RefreshToken — tablo `refresh_tokens`
Id, UserId(FK CASCADE), Token(string(256) unique), ExpiresAt, CreatedAt, RevokedAt(DateTime?), ReplacedByToken(string(256)?), + computed: IsRevoked/IsExpired/IsActive. Index: `Token` (unique), `UserId`.

### OutboxMessage — tablo `outbox_message`
Id, EventType(string(256)), Payload(string JSON), RoutingKey(string(256)), RetryCount(int), CreatedAtUtc, ProcessedAtUtc(DateTime?), LastError(string?). Index: `(ProcessedAtUtc, CreatedAtUtc)`. (Outbox pattern.)

### SyncRun — tablo `sync_run` (audit)
Id, StartedAt, CompletedAt, DurationMs(int), Status(SyncRunStatus short), LeaguesProcessed/Inserted/Updated, TeamsInserted/Updated, PlayersInserted/Updated, PositionsCreated, TransfersCreated, PlayersMarkedFree, ErrorCount(int), Errors(string?), FatalError(string?). Index: `StartedAt`.

### UserFavourite — tablo `user_favourite` (polimorfik)
Id, UserId, Type(FavouriteType short), TargetId(Guid — League/Team/Player/User), CreatedAt. Unique: `(UserId, Type, TargetId)`. FK yok (esneklik için; okuma sırasında Type'a göre çözülür).

### TransferPeriod — tablo `transfer_periods`
Id, Name(string(120)), PeriodType(string(40)?), StartDate, EndDate, CreatedAt. **Check:** `end_date >= start_date`. Index: `(StartDate, EndDate)`.

---

## Prisma Schema (referans implementasyon)

> Aşağıdaki şema mevcut tablo/kolon adlarını `@map`/`@@map` ile korur. **Önemli:** `@map` adlarını mevcut DB'deki gerçek kolon adlarıyla doğrula (EF default snake_case değil; configuration'larda explicit `HasColumnName` olabilir — `prisma db pull` ile teyit et). Enum saklama biçimine dikkat (yukarı bak).

```prisma
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }
generator client { provider = "prisma-client-js" }

// ---- Enums (saklama biçimine göre native enum veya Int) ----
enum UserStatus    { Active Inactive Banned Suspended }       // string saklanır
enum TransferSource{ Manual ApiSports }                       // string saklanır
// PostType, PostVoteChoice, FavouriteType, NotificationEventType, SyncRunStatus:
// DB'de SMALLINT saklandığı için Int kolon + app-enum kullan (native enum yerine).

model User {
  id            String    @id @default(uuid()) @db.Uuid
  username      String    @unique @db.VarChar(50)
  email         String    @unique @db.VarChar(256)
  passwordHash  String
  nickname      String    @db.VarChar(50)
  profilePic    String?   @db.VarChar(500)
  isMailConfirm Boolean   @default(false)
  status        UserStatus @default(Active)
  favouriteTeam String?   @db.VarChar(100)
  reputationScore Int     @default(0)
  role          String    @default("User") @db.VarChar(20)
  googleId      String?   @db.VarChar(256)
  createdAt     DateTime  @default(now()) @db.Timestamptz
  updatedAt     DateTime? @db.Timestamptz
  refreshTokens RefreshToken[]
  transfers     Transfer[]
  posts         Post[]
  comments      Comment[]
  postLikes     PostLike[]
  postVotes     PostVote[]
  commentLikes  CommentLike[]
  transferComments     TransferComment[]
  transferCommentLikes TransferCommentLike[]
  @@map("users")
}

model League {
  id                  String  @id @default(uuid()) @db.Uuid
  externalId          Int?    @unique
  name                String  @unique @db.VarChar(30)
  country             String  @db.VarChar(30)
  countryLogo         String
  leagueLogo          String
  logoLockedByAdmin   Boolean @default(false)
  leagueLogoSourceUrl String?
  leagueCode          String? @unique @db.VarChar(10)
  teams               Team[]
  @@map("league")
}

model Team {
  id                String  @id @default(uuid()) @db.Uuid
  externalId        Int?    @unique
  name              String  @unique @db.VarChar(50)
  logo              String?
  logoLockedByAdmin Boolean @default(false)
  logoSourceUrl     String?
  founded           Int?
  venueName         String? @db.VarChar(100)
  venueCity         String? @db.VarChar(100)
  venueCapacity     Int?
  leagueId          String  @db.Uuid
  league            League  @relation(fields: [leagueId], references: [id], onDelete: Restrict)
  players           Player[]
  incomingTransfers Transfer[] @relation("ToTeam")
  outgoingTransfers Transfer[] @relation("FromTeam")
  @@map("team")
}

model Position {
  id      String  @id @default(uuid()) @db.Uuid
  codeEn  String  @db.VarChar(5)
  nameEn  String  @db.VarChar(16)
  codeTr  String  @db.VarChar(5)
  nameTr  String  @db.VarChar(16)
  players Player[]
  @@map("position")
}

model Player {
  id                 String   @id @default(uuid()) @db.Uuid
  externalId         Int?     @unique
  firstName          String   @db.VarChar(32)
  lastName           String   @db.VarChar(32)
  nationality        String   @db.VarChar(32)
  birthDate          DateTime? @db.Date
  height             Int?     @db.SmallInt
  weight             Int?     @db.SmallInt
  photo              String?
  birthPlace         String?  @db.VarChar(32)
  birthCountry       String?  @db.VarChar(32)
  isFree             Boolean  @default(false)
  photoLockedByAdmin Boolean  @default(false)
  photoSourceUrl     String?
  teamId             String   @db.Uuid
  positionId         String?  @db.Uuid
  team               Team      @relation(fields: [teamId], references: [id], onDelete: Restrict)
  position           Position? @relation(fields: [positionId], references: [id], onDelete: SetNull)
  transfers          Transfer[]
  @@map("player")
}

model Transfer {
  id              String   @id @default(uuid()) @db.Uuid
  playerId        String   @db.Uuid
  fromTeamId      String   @db.Uuid
  toTeamId        String   @db.Uuid
  transferDate    DateTime @db.Timestamptz
  feeAmount       Decimal  @db.Decimal(18,2)
  feeCurrency     String   @db.VarChar(10)
  createdByUserId String?  @db.Uuid
  isRumour        Boolean  @default(false)
  isDeleted       Boolean  @default(false)
  source          TransferSource @default(Manual)
  createdAt       DateTime @default(now()) @db.Timestamptz
  updatedAt       DateTime? @db.Timestamptz
  player          Player   @relation(fields: [playerId], references: [id], onDelete: Restrict)
  fromTeam        Team     @relation("FromTeam", fields: [fromTeamId], references: [id], onDelete: Restrict)
  toTeam          Team     @relation("ToTeam", fields: [toTeamId], references: [id], onDelete: Restrict)
  createdByUser   User?    @relation(fields: [createdByUserId], references: [id], onDelete: SetNull)
  comments        TransferComment[]
  @@index([playerId, fromTeamId, toTeamId, transferDate])
  @@index([transferDate])
  @@index([feeAmount])
  @@map("transfers")
}

model Post {
  id              String   @id @default(uuid()) @db.Uuid
  ownerId         String   @db.Uuid
  content         String
  postType        Int      @db.SmallInt
  playerId        String?  @db.Uuid
  teamId          String?  @db.Uuid
  fromTeamId      String?  @db.Uuid
  toTeamId        String?  @db.Uuid
  likeCount       Int      @default(0) @db.SmallInt
  isVotingEnabled Boolean  @default(false)
  agreeCount      Int      @default(0)
  disagreeCount   Int      @default(0)
  commentCount    Int      @default(0)
  createdAtUtc    DateTime @default(now()) @db.Timestamptz
  owner           User     @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  comments        Comment[]
  likes           PostLike[]
  votes           PostVote[]
  @@index([createdAtUtc, id])
  @@map("post")
}

model PostLike {
  id           String   @id @default(uuid()) @db.Uuid
  postId       String   @db.Uuid
  userId       String   @db.Uuid
  createdAtUtc DateTime @default(now()) @db.Timestamptz
  post Post @relation(fields: [postId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([postId, userId])
  @@map("post_like")
}

model PostVote {
  id           String   @id @default(uuid()) @db.Uuid
  postId       String   @db.Uuid
  userId       String   @db.Uuid
  choice       Int      @db.SmallInt
  createdAtUtc DateTime @default(now()) @db.Timestamptz
  post Post @relation(fields: [postId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([postId, userId])
  @@map("post_vote")
}

model Comment {
  id           String   @id @default(uuid()) @db.Uuid
  ownerId      String   @db.Uuid
  content      String?
  postId       String   @db.Uuid
  parentId     String?  @db.Uuid
  likeCount    Int      @default(0) @db.SmallInt
  createdAtUtc DateTime @default(now()) @db.Timestamptz
  owner   User      @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  post    Post      @relation(fields: [postId], references: [id], onDelete: Cascade)
  parent  Comment?  @relation("CommentReplies", fields: [parentId], references: [id], onDelete: Cascade)
  replies Comment[] @relation("CommentReplies")
  likes   CommentLike[]
  @@map("comment")
}

model CommentLike {
  id String @id @default(uuid()) @db.Uuid
  commentId String @db.Uuid
  userId    String @db.Uuid
  createdAtUtc DateTime @default(now()) @db.Timestamptz
  comment Comment @relation(fields: [commentId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([commentId, userId])
  @@map("comment_like")
}

model TransferComment {
  id String @id @default(uuid()) @db.Uuid
  transferId String @db.Uuid
  ownerId    String @db.Uuid
  content    String?
  parentId   String? @db.Uuid
  likeCount  Int @default(0) @db.SmallInt
  createdAtUtc DateTime @default(now()) @db.Timestamptz
  transfer Transfer @relation(fields: [transferId], references: [id], onDelete: Cascade)
  owner    User     @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  parent   TransferComment? @relation("TCReplies", fields: [parentId], references: [id], onDelete: Cascade)
  replies  TransferComment[] @relation("TCReplies")
  likes    TransferCommentLike[]
  @@map("transfer_comment")
}

model TransferCommentLike {
  id String @id @default(uuid()) @db.Uuid
  transferCommentId String @db.Uuid
  userId String @db.Uuid
  createdAtUtc DateTime @default(now()) @db.Timestamptz
  transferComment TransferComment @relation(fields: [transferCommentId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([transferCommentId, userId])
  @@map("transfer_comment_like")
}

model News {
  id         String   @id @default(uuid()) @db.Uuid  // kolon: news_id
  publishDate DateTime @default(now()) @db.Timestamptz
  playerId   String?  @db.Uuid
  fromTeamId String?  @db.Uuid
  toTeamId   String?  @db.Uuid
  slug       String   @db.VarChar(256)
  imageUrl   String?
  sourceName String?  @db.VarChar(128)
  sourceUrl  String?
  title      String
  content    String?
  @@index([playerId]); @@index([toTeamId]); @@index([fromTeamId])
  @@index([sourceName]); @@index([publishDate])
  @@map("news")
}

model CurrencyRate {
  id String @id @default(uuid()) @db.Uuid
  currencyCode     String @db.VarChar(10)
  baseCurrencyCode String @db.VarChar(10)
  rate             Decimal @db.Decimal(18,8)
  rateDate         DateTime @db.Timestamptz
  createdAt        DateTime @default(now()) @db.Timestamptz
  @@unique([currencyCode, baseCurrencyCode, rateDate])
  @@index([rateDate])
  @@map("currency_rates")
}

model Notification {
  id String @id @default(uuid()) @db.Uuid
  userId     String @db.Uuid
  eventType  Int    @db.SmallInt
  title      String @db.VarChar(200)
  body       String @db.VarChar(500)
  transferId String? @db.Uuid
  isRead     Boolean @default(false)
  createdAt  DateTime @default(now()) @db.Timestamptz
  @@index([userId, createdAt])
  @@unique([userId, transferId, eventType])
  @@map("notification")
}

model NotificationPreference {
  id String @id @default(uuid()) @db.Uuid
  userId    String @db.Uuid
  eventType Int    @db.SmallInt
  enabled   Boolean @default(true)
  @@unique([userId, eventType])
  @@map("notification_preference")
}

model PasswordResetToken {
  id String @id @default(uuid()) @db.Uuid
  userId    String @db.Uuid
  tokenHash String @db.VarChar(128)
  expiresAt DateTime @db.Timestamptz
  usedAt    DateTime? @db.Timestamptz
  createdAt DateTime @default(now()) @db.Timestamptz
  @@index([tokenHash]); @@index([userId])
  @@map("password_reset_token")
}

model RefreshToken {
  id String @id @default(uuid()) @db.Uuid
  userId          String @db.Uuid
  token           String @unique @db.VarChar(256)
  expiresAt       DateTime @db.Timestamptz
  createdAt       DateTime @default(now()) @db.Timestamptz
  revokedAt       DateTime? @db.Timestamptz
  replacedByToken String? @db.VarChar(256)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
  @@map("refresh_tokens")
}

model OutboxMessage {
  id String @id @default(uuid()) @db.Uuid
  eventType     String @db.VarChar(256)
  payload       String
  routingKey    String @db.VarChar(256)
  retryCount    Int
  createdAtUtc  DateTime @default(now()) @db.Timestamptz
  processedAtUtc DateTime? @db.Timestamptz
  lastError     String?
  @@index([processedAtUtc, createdAtUtc])
  @@map("outbox_message")
}

model SyncRun {
  id String @id @default(uuid()) @db.Uuid
  startedAt DateTime @db.Timestamptz
  completedAt DateTime @db.Timestamptz
  durationMs Int
  status Int @db.SmallInt
  leaguesProcessed Int; leaguesInserted Int; leaguesUpdated Int
  teamsInserted Int; teamsUpdated Int
  playersInserted Int; playersUpdated Int
  positionsCreated Int; transfersCreated Int; playersMarkedFree Int
  errorCount Int; errors String?; fatalError String?
  @@index([startedAt])
  @@map("sync_run")
}

model UserFavourite {
  id String @id @default(uuid()) @db.Uuid
  userId   String @db.Uuid
  type     Int    @db.SmallInt
  targetId String @db.Uuid
  createdAt DateTime @default(now()) @db.Timestamptz
  @@unique([userId, type, targetId])
  @@map("user_favourite")
}

model TransferPeriod {
  id String @id @default(uuid()) @db.Uuid
  name       String @db.VarChar(120)
  periodType String? @db.VarChar(40)
  startDate  DateTime @db.Timestamptz
  endDate    DateTime @db.Timestamptz
  createdAt  DateTime @default(now()) @db.Timestamptz
  @@index([startDate, endDate])
  @@map("transfer_periods")
}
```

## Migration Notları (kritik)

1. **Soft delete (`Transfer.isDeleted`):** EF global filter'ı Prisma'da yok. Tüm transfer/rumour okumalarında `where: { isDeleted: false }` ekle veya Prisma Client Extension (`$allModels.findMany` override) ile uygula. Silme = `update isDeleted:true`.
2. **Computed alanlar** (`FullName`, RefreshToken/PasswordResetToken `IsActive` vb.) saklanmaz — uygulama katmanında hesapla.
3. **Check constraint'ler** (Post FK-shape, PostVote choice, TransferPeriod tarih): Prisma şemada ifade edilemez; migration SQL'ine `@@.raw` yerine manuel SQL ekle (veya mevcut DB'de zaten var). DTO validation ile de zorla.
4. **Enum saklama:** SMALLINT saklanan enum'ları `Int` kolon olarak tut, TS tarafında enum sabitleriyle eşle (`enum PostType { Transfer=1, Team=2, Player=3 }`). String saklanan ikisini (UserStatus, TransferSource) Prisma native enum yapabilirsin.
5. **`@map` adlarını doğrula:** EF configuration'larındaki gerçek kolon adları için `prisma db pull` çıktısını baz al; bu doküman tablo adlarını verir ama bazı kolonların explicit `HasColumnName`'i olabilir.
