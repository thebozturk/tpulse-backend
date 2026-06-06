# TransferPulse — Uygulama Mantığı, DTO'lar & Servis Sözleşmeleri (03)

> Kaynak: `TransferPulse.Application` (Features/Commands/Queries, DTOs, Interfaces, Common/Behaviors) + `TransferPulse.Infrastructure/Repositories`. NestJS'te bu interface'ler **provider/service** olur; validator'lar **class-validator DTO**'ya, MediatR handler'ları **service metodlarına** dönüşür.

## 1. CQRS / MediatR → NestJS

Mevcut yapı: MediatR `Command`/`Query` + `Handler` + `ValidationBehavior` pipeline (tüm validator'ları çalıştırır, başarısızsa `ValidationException` fırlatır → middleware 400'e çevirir).

> Not: CQRS yalnızca **News** ve **Users** feature'larında tam kullanılır. Diğer alanlar (Transfer, Rumour, Post, Comment, Team, Player, League, Favourite, Notification, Search, Image) doğrudan **controller → repository/service** çağrısıyla çalışır. NestJS'te en sade yol: **her feature için bir service**, controller'lar service'i çağırır.

**NestJS yaklaşımı (önerilen):**
- `@nestjs/cqrs` kullanmaya **gerek yok**. Her modülde `XxxService` provider'ı, controller onu enjekte eder.
- Validation: DTO'lara `class-validator` decorator'ları + global `ValidationPipe({ whitelist:true, transform:true })`.
- `ValidationException` davranışı: global `ValidationPipe` zaten 400 döndürür; özel exception filter ile envelope (`{success:false,message,errors}`) formatına çevir.

## 2. Response Envelope & Pagination

```csharp
Result<T>        { IsSuccess: bool, Data: T?, Error: string? }   // Success(data) / Failure(error)
PagedResult<T>   { Items: List<T>, TotalCount, Page, PageSize,
                   TotalPages = ceil(TotalCount/PageSize), HasPreviousPage, HasNextPage }
```
Controller'lar çoğunlukla envelope'u manuel kurar: `{ success, message, data }` ve sayfalamada `{ items, page, pageSize, totalCount, totalPages }`.

**NestJS:**
```typescript
interface PagedResult<T> {
  items: T[]; page: number; pageSize: number; totalCount: number; totalPages: number;
}
// Yardımcı: buildPaged(items, total, page, pageSize)
// Envelope'u ister interceptor ile standartlaştır, ister controller'da elle kur (mevcut davranışı bire bir koru).
```

## 3. Validation Kuralları (FluentValidation → class-validator)

### RegisterUserCommand / CreateUserCommand
- `Username`: required, 3–50 karakter
- `Email`: required, geçerli email
- `Password`: required, min 8, **en az 1 büyük + 1 küçük + 1 rakam** (`[A-Z]`, `[a-z]`, `[0-9]`)
- `Nickname`: required, max 50
- (Register) `FavouriteTeam`: opsiyonel

```typescript
export class RegisterUserDto {
  @IsNotEmpty() @MinLength(3) @MaxLength(50) username: string;
  @IsNotEmpty() @IsEmail() email: string;
  @IsNotEmpty() @MinLength(8)
  @Matches(/[A-Z]/, { message: 'En az bir büyük harf.' })
  @Matches(/[a-z]/, { message: 'En az bir küçük harf.' })
  @Matches(/[0-9]/, { message: 'En az bir rakam.' })
  password: string;
  @IsNotEmpty() @MaxLength(50) nickname: string;
  @IsOptional() @IsString() favouriteTeam?: string;
}
```

### LoginUserCommand
- `Email`: required, email · `Password`: required

### CreateNewsCommand / UpdateNewsCommand
- `Title`: required · `Slug`: required, max 256 · `Content`: required · `SourceName`: max 128 (set ise) · (Update) `NewsId`: required

### BulkDeleteNewsCommand
- `Ids`: required, en az 1, **max 100**

> Diğer feature'larda validation çoğunlukla controller içi guard'lar/DTO `[Required]` + iş kuralı kontrolleriyle yapılır (örn. AdminTeam isim benzersizliği 409, TransferPeriod `endDate≥startDate` 400, Post `PostType` shape 400). Bunları NestJS'te DTO validation + service-level kontrol ile koru.

## 4. Uygulama Interface'leri (NestJS provider'larına dönüşür)

### Persistence soyutlaması
`IApplicationDbContext` — tüm `DbSet`'leri açar. **NestJS'te bu Prisma'nın `PrismaService`'idir** (tüm modellere erişim). Repository'ler `PrismaService`'i enjekte eder.

### Repository interface'leri (→ NestJS repository/service provider'ları)

**IUserRepository:** `getById`, `getByEmail`, `getByUsername`, `getByGoogleId`, `getAll(page,pageSize)→(items,total)`, `add`, `update`, `delete`, `exists`.

**INewsRepository:** `getById`, `getAll(page,pageSize,sortBy,order)`, `getByPlayerId`, `getByToTeamId`, `getByFromTeamId`, `getBySourceName`, `getByDateRange`, `add`, `update`, `delete`, `deleteBulk(ids)→int`, `exists`.

**IPlayerRepository:** `getAll(PlayerFilterDto)`, `searchByName(query,page,pageSize)`, `getById`, `getByTeamId`, `getByNationality`, `getFreeAgents`, `create`, `update`, `delete`, `exists`.

**ITeamRepository:** `getAll(page,pageSize)`, `getById`, `getDetailById` (lig+kadro incl. position), `getByLeagueId`, `searchByName(query,limit)` (pg_trgm), `getByName`, `create`, `update`, `delete`, `exists`.

**ILeagueRepository:** `getAll`, `getById`, `searchByName(query,limit)`, `getByCode`, `create`, `update`, `delete`, `exists`.

**ITransferRepository** (en geniş): `getAll(TransferFilterDto)`, `getById`, `getByPlayerId`, `getLastTransferByPlayerId`, `getIncomingByTeamId`, `getOutgoingByTeamId`, `getAllByTeamId`, `getLatest(take,page,pageSize)`, `getTopExpensive(take,currency,page,pageSize)`, `getBetweenTeams(from,to,includeReverse)`, `getByYear`, `getByMonth`, `getLeagueIncoming/Outgoing(LeagueTransferFilterDto)`, `getByLeagueId(leagueId,year,page,pageSize)`, `getLatestByLeagueId`, `getLatestByAllLeagues(take,year)`, `getStats(TransferStatsFilterDto)`, `getPeriodSummary`, `getSeasonDashboard`, `getTransferPeriods(year)`, `getTransferPeriodById`, `createTransferPeriod`, `updateTransferPeriod`, `deleteTransferPeriod`, + **Rumour**: `getRumours(RumourFilterDto)`, `getRumourById`, `getRumoursByPlayerId`, `getRumoursByTeamId`, `getLatestRumours`, `createRumour`, `updateRumour`, `softDeleteRumour`, + genel: `existsById`, `create`, `update`, `exists(player,from,to,date)`, `softDelete`.

**IPostRepository:** `getNewCountAfter(afterPostId)`, `getAll(PostFilterDto, FavouriteTargets?)` (favori filtreli), `getById`, `getByOwnerId`, `getByPlayerId`, `getByTeamId`, `create`, `update`, `delete`, `exists`, `like(id,userId)`, `unlike`, `getLikedPostIds(userId,ids)`, `getUserVotes(userId,ids)→Map<id,Choice>`, `vote(postId,userId,choice)→PostVoteResultDto`.

**ICommentRepository:** `getByPostId`, `getById`, `create`, `update`, `delete`, `like`, `unlike`, `getLikedCommentIds(userId,ids)`.

**ITransferCommentRepository:** `getByTransferId`, `getById`, `create`, `update`, `delete`, `like`, `unlike`, `getLikedCommentIds`.

**IRefreshTokenRepository:** `getByToken`, `getActiveByUserId`, `create`, `revoke(id,replacedBy?)`, `revokeAllByUserId`.

### Servis interface'leri

**ITokenService:** `generateAccessToken(user)→string`, `generateRefreshToken(userId)→RefreshToken`.
**IPasswordHasher:** `hash(password)`, `verify(password,hash)` — BCrypt (work factor 12).
**IPasswordResetService:** `requestReset(email)`, `reset(email,token,newPassword)→{Success|InvalidToken|WeakPassword}`.
**IEmailSender:** `send(to,subject,htmlBody)`.

**INotificationService:**
- `generateForTransfer(transferId)→int` — transfer/rumour oluşunca favori eşleşen kullanıcılara bildirim üretir (dedup + opt-out).
- `getForUser(userId,page,pageSize,unreadOnly)→(items,total)`
- `getUnreadCount(userId)`, `markRead(userId,notifId)`, `markAllRead(userId)`
- `getPreferences(userId)`, `setPreferences(userId,prefs)`

**IFavouriteService:**
- `getForUser(userId)→FavouriteDto[]` (isim+görsele çözülmüş)
- `add(userId,type,targetId)→{Added|AlreadyExists|TargetNotFound}`
- `remove(userId,favouriteId)`, `set(userId,favourites[])→FavouriteDto[]`
- `getTargets(userId)→FavouriteTargets(playerIds, teamIds, reporterUserIds)` — **lig favorisi takım ID'lerine genişletilir**, feed filtresi için.

**ISearchService:** `search(query,limitPerType)→SearchResultsDto` (pg_trgm fuzzy; Elasticsearch'e geçişe hazır).

**IFootballDataClient** (API-Football anti-corruption): `getLeague(extId,season)`, `getTeamsByLeague(extId,season)`, `getPlayersByTeam(extId,season)`, `getTransfersByTeam(extId)`.

**IFootballDataSyncService:** `syncAll()→SyncResult`, `syncLeague(extId)`.
**IFootballDataSeeder:** `seed(jsonStream)→SeedResult` (`leagues_with_players.json`).

**IStorageService** (R2/S3): `upload(stream,folder,fileName,contentType="image/webp")→cdnUrl`, `delete(cdnUrl)`.
**IImageService:** `convertToWebP(stream,quality=80)`, `isValidImageFormat(fileName)`, `isValidFileSize(bytes,maxMb=5)`.
**IImageDownloader:** `download(url)→stream` (SSRF koruması: private/loopback IP bloke).
**IImageMirror:** `mirror(sourceUrl,folder,entityId)→r2Url` (indir→WebP→yükle, deterministik dosya adı).

**IEventPublisher:** `publish(eventType,payload)`.
**IOutboxService:** `enqueue(eventType,payload)`.
**IIdempotencyService:** `tryAcquire(key,ttl)→bool` (Redis SET NX).

## 5. DTO Şekilleri (gruplu)

### Auth & User
- **UserDto:** `id, username, email, nickname, profilePic?, isMailConfirm, status(UserStatus), favouriteTeam?, reputationScore, createdAt`
- **AuthResponseDto:** `accessToken, refreshToken, expiresAt, user:UserDto`
- **RefreshTokenRequestDto:** `refreshToken`
- **GoogleAuthDto:** `idToken`
- **ForgotPasswordDto:** `email` · **ResetPasswordDto:** `email, token, newPassword`

### News
- **NewsDto:** `newsId, publishDate, playerId?, playerName?, playerNationality?, playerPhoto?, fromTeamId?, fromTeamName?, fromTeamLogo?, toTeamId?, toTeamName?, toTeamLogo?, slug, imageUrl?, sourceName?, sourceUrl?, title, content`

### Transfer & Rumour
- **CreateTransferDto / UpdateTransferDto:** `playerId, fromTeamId, toTeamId, transferDate, feeAmount, feeCurrency`
- **PatchTransferDto:** `feeAmount?, feeCurrency?, transferDate?`
- **TransferFilterDto:** `playerId?, fromTeamId?, toTeamId?, dateFrom?, dateTo?, feeMin?, feeMax?, currency?, sort?, page=1, pageSize(≤100)`
- **RumourDto:** zengin — `id, player* (name/photo/nationality/birthDate/height/weight/birthPlace/birthCountry/isFree/positionName/positionCode/teamId/teamName), fromTeam*(id/name/logo), toTeam*(id/name/logo), feeAmount, feeCurrency, createdByUserId?, createdByUsername?, createdByPhoto?, createdByUserRole?, createdAt, updatedAt?`
- **CreateRumourDto / UpdateRumourDto:** `playerId, fromTeamId, toTeamId, feeAmount?, feeCurrency?`
- **RumourFilterDto:** `playerId?, fromTeamId?, toTeamId?, ownerId?, dateFrom?, dateTo?, sort?, page=1, pageSize=20`
- **ConfirmRumourDto:** `feeAmount, feeCurrency, transferDate`
- **TransferStatsDto:** `totalTransfers, totalSpent, averageFee, maxFee, minFee, mostExpensiveTransfer?, latestTransfer?, earliestTransfer?, mostActiveBuyerTeam?, mostActiveSellerTeam?, mostTransferredPlayer?, highestFeePlayer?`
- **TransferPeriodDto:** `id, name, periodType?, startDate, endDate`
- **TeamTransferLineDto:** `transferId, playerId, playerName, playerPhoto?, fromTeamId, fromTeamName?, fromTeamLogo?, toTeamId, toTeamName?, toTeamLogo?, transferDate, feeAmount, feeCurrency, createdAt`
- **LeagueTransfersDto** (latest-by-leagues): lig + transfer listesi grupları.
- **TransferPeriodSummaryDto / TransferSeasonDashboardDto:** dönem/sezon agregasyonları (top transferler, toplam harcama, baseCurrency çevrimi).

### Player / Team / League
- **PlayerDto:** `id, firstName, lastName, fullName, nationality, birthDate?, height?, weight?, photo?, birthPlace?, birthCountry?, isFree, teamId, teamName, teamLogo?, positionId?, positionName?`
- **CreatePlayerDto / UpdatePlayerDto:** PlayerDto'nun yazılabilir alanları (`teamId, positionId?` dahil)
- **PlayerFilterDto:** `teamId?, nationality?, positionId?, isFree?, search?, page=1, pageSize=20`
- **PlayerProfileDto:** `player:PlayerDto, transfers:TeamTransferLineDto[], news:[...], posts:[...]`
- **TeamDto:** `id, name, logo?, leagueId, leagueName, playerCount`
- **CreateTeamDto / UpdateTeamDto:** `name, logo?, leagueId`
- **TeamDetailDto:** `id, name, logo?, founded?, venueName?, venueCity?, venueCapacity?, leagueId, leagueName, leagueLogo?, playerCount, squad:SquadPlayerDto[], recentIncoming:TeamTransferLineDto[], recentOutgoing:[]`
- **LeagueDto:** `id, name, country, countryLogo, leagueLogo, leagueCode?, teamCount`
- **CreateLeagueDto / UpdateLeagueDto:** `name, country, countryLogo, leagueLogo, leagueCode?`

### Post & Comment
- **PostDto:** `id, ownerId, ownerName, ownerPhoto?, isMailConfirm, userRole, content, postType, playerId?, playerName?, playerPhoto?, teamId?, teamName?, teamLogo?, fromTeam*(id/name/logo), toTeam*(id/name/logo), likeCount, isLiked, isVotingEnabled, agreeCount, disagreeCount, totalVotes(computed), agreePercentage(computed), disagreePercentage(computed), userVote?, createdAtUtc, commentCount`
- **CreatePostDto:** `content(≤5000), postType, playerId?, teamId?, fromTeamId?, toTeamId?, isVotingEnabled`
- **UpdatePostDto:** `content(≤5000), playerId?, teamId?, fromTeamId?, toTeamId?`
- **PostFilterDto:** `playerId?, teamId?, ownerId?, search?, onlyFavourites, page=1, pageSize(≤100)`
- **CommentDto / TransferCommentDto:** `id, ownerId, ownerName, ownerPhoto?, content?, postId|transferId, parentId?, likeCount, isLiked, createdAtUtc, replies:[...]`
- **CreateCommentDto / CreateTransferCommentDto:** `content(≤2000), parentId?`
- **VotePostDto:** `choice:PostVoteChoice` · **PostVoteResultDto:** `result(Invalid|Unchanged|Applied), agreeCount, disagreeCount, totalVotes, agreePercentage, disagreePercentage, userVote?`

### Notification & Favourite & Search
- **NotificationDto:** `id, eventType, title, body, transferId?, isRead, createdAt`
- **NotificationPreferenceDto:** `eventType, enabled` · **SetNotificationPreferencesDto:** `preferences[]`
- **FavouriteDto:** `id, type, targetId, name, imageUrl?, createdAt`
- **AddFavouriteDto:** `type, targetId` · **SetFavouritesDto:** `favourites[]`
- **SearchResultItemDto:** `type("player"|"team"|"league"), id, name, imageUrl?, subtitle?`
- **SearchResultsDto:** `players[], teams[], leagues[]`

## 6. Önemli İş Mantığı Parçaları

### VoteMath (oylama yüzdeleri — birebir taşı)
```typescript
const total = (a:number,d:number) => a + d;
const agreePct = (a:number,d:number) => { const t=total(a,d); return t===0?0:Math.round(a*100/t); };
const disagreePct = (a:number,d:number) => { const t=total(a,d); return t===0?0:100-agreePct(a,d); };
```
`PostVoteApplyResult = { Invalid, Unchanged, Applied }` (post yok/voting kapalı | aynı oy | yeni/değişen oy).

### FavouriteTargets (feed filtresi)
`record FavouriteTargets(PlayerIds, TeamIds, ReporterUserIds)` — `IPostRepository.getAll(filter, favourites)` `onlyFavourites=true` ise postları bu hedeflere kısıtlar. Lig favorileri **depolamadan önce** takım ID'lerine genişletilir.

### Notification üretim mantığı (NotificationService)
Transfer/rumour oluşunca eşleştirme:
- Player favorisi → `Transfer.PlayerId`
- Team favorisi → `Transfer.FromTeamId` veya `ToTeamId`
- League favorisi → takımın ligi
- Reporter favorisi → transferi oluşturan kullanıcı (`CreatedByUserId`)
Opt-out: `NotificationPreference(enabled=false)` satırı varsa atla. Dedup: `(UserId, TransferId, EventType)` unique.
