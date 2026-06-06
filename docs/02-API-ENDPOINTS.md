# TransferPulse — API Endpoint Referansı (02)

> Kaynak: `TransferPulse.Api/Controllers/*`. 30 controller, ~120 endpoint. NestJS'te route'lar, method'lar ve response şekilleri **birebir** korunmalı.

## Genel Kurallar

- **Base path:** Tüm route'lar `/api` altında.
- **Auth:** `[Authorize]` = giriş gerekli; `[Authorize(Roles="Admin")]` = admin; `[Authorize(Roles="Admin,Reporter")]` = admin veya reporter; `[AllowAnonymous]` = public.
- **Response envelope (yazma/aksiyon uçları):** `{ success: bool, message: string, data?: object }`. Hatalarda `{ success:false, message, errors? }`.
- **Sayfalama envelope:** `{ items: T[], page, pageSize, totalCount, totalPages }`.
- **Tekil getter:** `{ data: T }`. Liste (sayfasız): `{ items: T[] }`.
- **Rate limit policy'leri:** `auth` (login/register), `write` (POST/PUT/DELETE/PATCH controller'ları), global. NestJS'te `@nestjs/throttler` ile aynı limitleri uygula (bkz. 04).
- **Idempotency:** Yazma uçlarında `Idempotency-Key` header'ı opsiyonel; varsa Redis ile tekrar koruması.

---

## AUTH & USER

### AuthController — `api/auth` (rate limit: `auth`)
| Method | Route | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/api/auth/register` | public | `{ username, email, password, nickname, favouriteTeam? }` | 200 `AuthResponseDto` / 400 |
| POST | `/api/auth/login` | public | `{ email, password }` | 200 `AuthResponseDto` / 401 |
| POST | `/api/auth/forgot-password` | public | `{ email }` | 200 `{success,message}` (her zaman 200 — email var/yok sızdırmaz) |
| POST | `/api/auth/reset-password` | public | `{ email, token, newPassword }` | 200 / 400 (zayıf parola/geçersiz token) |
| POST | `/api/auth/refresh` | public | `{ refreshToken }` | 200 `{ accessToken, refreshToken, expiresAt }` / 401 (token rotation) |
| POST | `/api/auth/logout` | auth | `{ refreshToken }` | 200 (token revoke) |
| POST | `/api/auth/revoke-all` | auth | — | 200 (tüm cihazlardan çıkış) |
| POST | `/api/auth/google` | public | `{ idToken }` | 200 `AuthResponseDto` / 400 (Google ID token doğrula, email ile eşle/oluştur) |

`AuthResponseDto = { accessToken, refreshToken, expiresAt, user: UserDto }`

### UsersController — `api/users` (Admin, rate limit: `write`)
| Method | Route | Body | Response |
|---|---|---|---|
| POST | `/api/users` | `{ username, email, password, nickname, profilePic?, favouriteTeam? }` | 201 `UserDto` |
| GET | `/api/users/{id:guid}` | — | 200 `UserDto` / 404 |
| GET | `/api/users?page=1&pageSize=10` | — | 200 `PagedResult<UserDto>` |
| PUT | `/api/users/{id:guid}` | `{ id, nickname?, profilePic?, favouriteTeam? }` | 200 `UserDto` / 400 (id mismatch) / 404 |
| DELETE | `/api/users/{id:guid}` | — | 204 / 404 |

---

## ME (oturum açmış kullanıcı) — hepsi `[Authorize]`, rate limit `write`

### MeFavouritesController — `api/me/favourites`
| Method | Route | Body | Response |
|---|---|---|---|
| GET | `/api/me/favourites` | — | 200 `{ items: FavouriteDto[] }` (isim+görsele çözülmüş) |
| POST | `/api/me/favourites` | `{ type: FavouriteType, targetId }` | 201 eklendi / 200 `{unchanged:true}` / 404 target yok |
| DELETE | `/api/me/favourites/{favouriteId:guid}` | — | 200 / 404 |
| PUT | `/api/me/favourites` | `{ favourites: [{type,targetId}] }` | 200 `{ items }` — **tüm seti değiştir** (onboarding sync) |

### MeNotificationsController — `api/me/notifications`
| Method | Route | Query | Response |
|---|---|---|---|
| GET | `/api/me/notifications` | `page=1, pageSize=20, unreadOnly=false` | 200 `{ items: NotificationDto[], page, pageSize, totalCount, totalPages }` |
| GET | `/api/me/notifications/unread-count` | — | 200 `{ count }` |
| POST | `/api/me/notifications/{id:guid}/read` | — | 200 / 404 |
| POST | `/api/me/notifications/read-all` | — | 200 `{ data: { count } }` |

### MeNotificationPreferencesController — `api/me/notification-preferences`
| Method | Route | Body | Response |
|---|---|---|---|
| GET | `/api/me/notification-preferences` | — | 200 `{ items: [{eventType, enabled}] }` (tüm event type'lar, etkin durum) |
| PUT | `/api/me/notification-preferences` | `{ preferences: [{eventType, enabled}] }` | 200 `{ items }` |

### ProfilePhotoController — `api/profile/photo`
| Method | Route | Body | Response |
|---|---|---|---|
| POST | `/api/profile/photo` | multipart `image` (jpg/jpeg/png/webp, ≤5MB) | 200 `{ data:{url} }` — WebP'ye çevir (q80), R2'ye yükle |
| PUT | `/api/profile/photo` | multipart `image` | 200 `{ data:{url} }` — eskisini sil, yenisini yükle |
| POST | `/api/profile/photo/from-url` | `{ imageUrl }` | 200 `{ data:{url} }` — URL'den indir+yükle |
| GET | `/api/profile/photo` | — | 200 `{ data:{url} }` / 404 |
| DELETE | `/api/profile/photo` | — | 200 / 400 (foto yok) / 404 |

---

## KATALOG (public okuma)

### SearchController — `api/search` (public)
| Method | Route | Query | Response |
|---|---|---|---|
| GET | `/api/search` | `q` (zorunlu), `limit=5` | 200 `{ query, data:{ players[], teams[], leagues[] } }` (her item `{type,id,name,imageUrl,subtitle}`) / 400 (q boş) |

### LeagueController — `api/leagues` (public)
| Method | Route | Query | Response |
|---|---|---|---|
| GET | `/api/leagues` | `page=1, pageSize=20` | 200 paged `LeagueDto` |
| GET | `/api/leagues/{id:guid}` | — | 200 `{data:LeagueDto}` / 404 |
| GET | `/api/leagues/by-code/{code}` | — | 200 `{data}` / 404 |
| GET | `/api/leagues/{leagueId:guid}/transfers` | `year?, page=1, pageSize=20` | 200 paged Transfer |
| GET | `/api/leagues/{leagueId:guid}/transfers/latest` | `take=5, year?` | 200 `{items}` |
| GET | `/api/leagues/{leagueId:guid}/transfers/incoming` | `dateFrom?, dateTo?, teamId?, positionId?, sort?, page=1, pageSize=20` | 200 paged |
| GET | `/api/leagues/{leagueId:guid}/transfers/outgoing` | (aynı filtreler) | 200 paged |

### TeamController — `api/teams` (public)
| Method | Route | Query | Response |
|---|---|---|---|
| GET | `/api/teams` | `page=1, pageSize=20` | 200 paged `TeamDto` |
| GET | `/api/teams/{id:guid}` | — | 200 `{data:TeamDto}` / 404 |
| GET | `/api/teams/{id:guid}/detail` | — | 200 `{data:TeamDetailDto}` (kadro + son 10 gelen/10 giden transfer) |
| GET | `/api/teams/by-league/{leagueId:guid}` | — | 200 `{items:TeamDto[]}` |

### TeamTransferController — `api/teams` (public)
| Method | Route | Response |
|---|---|---|
| GET | `/api/teams/{teamId:guid}/incoming-transfers` | 200 `{items:TeamTransferLineDto[]}` |
| GET | `/api/teams/{teamId:guid}/outgoing-transfers` | 200 `{items}` |
| GET | `/api/teams/{teamId:guid}/transfers` | 200 `{items}` (gelen+giden) |

### PlayerController — `api/players` (public)
| Method | Route | Query | Response |
|---|---|---|---|
| GET | `/api/players` | `teamId?, nationality?, positionId?, isFree?, search?, page=1, pageSize=20` | 200 paged `PlayerDto` |
| GET | `/api/players/{id:guid}` | — | 200 `{data:PlayerDto}` / 404 |
| GET | `/api/players/{id:guid}/profile` | — | 200 `{data:PlayerProfileDto}` (transfer 20 + haber 10 + post 10) |
| GET | `/api/players/by-team/{teamId:guid}` | — | 200 `{items}` |
| GET | `/api/players/by-nationality/{nationality}` | — | 200 `{items}` |
| GET | `/api/players/free-agents` | — | 200 `{items}` |
| GET | `/api/players/search` | `query` (zorunlu), `page=1, pageSize=20` (1-50 clamp) | 200 paged / 400 — **bot kullanır** |

### PlayerTransferController — `api/players` (public)
| Method | Route | Response |
|---|---|---|
| GET | `/api/players/{playerId:guid}/transfers` | 200 `{items:TeamTransferLineDto[]}` |
| GET | `/api/players/{playerId:guid}/last-transfer` | 200 `{data}` / 404 |

---

## TRANSFER & RUMOUR

### TransferQueryController — `api/transfers` (public)
| Method | Route | Query/Body | Response |
|---|---|---|---|
| GET | `/api/transfers` | filter: `playerId?, fromTeamId?, toTeamId?, dateFrom?, dateTo?, feeMin?, feeMax?, currency?, sort?, page=1, pageSize(≤100)` | 200 paged |
| GET | `/api/transfers/{id:guid}` | — | 200 `{data}` / 404 |
| GET | `/api/transfers/latest` | `take=10, page=1, pageSize=20` | 200 paged |
| GET | `/api/transfers/top-expensive` | `take=10, currency?, page=1, pageSize=20` | 200 paged |
| GET | `/api/transfers/between-teams` | `fromTeamId, toTeamId, includeReverse=false` | 200 `{items}` |
| GET | `/api/transfers/by-year/{year:int}` | — | 200 `{items}` |
| GET | `/api/transfers/by-month/{year:int}/{month:int}` | — | 200 `{items}` |
| GET | `/api/transfers/latest-by-leagues` | `take=5, year?` | 200 `{items:LeagueTransfersDto[]}` |
| GET | `/api/transfers/stats` | filter: `playerId?, teamId?, dateFrom?, dateTo?, currency?, year?, month?, transferPeriodId?` | 200 `TransferStatsDto` |
| GET | `/api/transfers/periods` | `year?` | 200 `{items}` / 400 (1900≤year≤now+1) |
| GET | `/api/transfers/period-summary` | `year? veya transferPeriodId?` (biri zorunlu), `baseCurrency=EUR` | 200 / 400 |
| GET | `/api/transfers/season-dashboard` | `year?/transferPeriodId?, baseCurrency=EUR, topN=5 (1-20)` | 200 / 400 |

### RumourController — `api/rumours`
| Method | Route | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/api/rumours` | public | filter: `playerId?, fromTeamId?, toTeamId?, ownerId?, dateFrom?, dateTo?, sort?, page=1, pageSize=20` | 200 paged `RumourDto` |
| GET | `/api/rumours/{id:guid}` | public | — | 200 `{data}` / 404 |
| GET | `/api/rumours/latest` | public | `take=10, page=1, pageSize=20` | 200 `{items}` |
| GET | `/api/rumours/by-player/{playerId:guid}` | public | — | 200 `{items}` |
| GET | `/api/rumours/by-team/{teamId:guid}` | public | — | 200 `{items}` |
| POST | `/api/rumours` | Admin,Reporter | `{ playerId, fromTeamId, toTeamId, feeAmount?, feeCurrency? }` | 201 `{data:{rumourId}}` / 404 — **bildirim job'ı tetikler. bot kullanır** |
| PUT | `/api/rumours/{id:guid}` | Admin,Reporter | (create ile aynı) | 200 / 403 (yazar değil) / 404 |
| DELETE | `/api/rumours/{id:guid}` | Admin,Reporter | — | 200 (soft delete) / 403 / 404 |
| POST | `/api/rumours/{id:guid}/confirm` | Admin | `{ feeAmount, feeCurrency, transferDate }` | 200 `{data:{transferId}}` / 404 — rumour→transfer, bildirim tetikler |

### TransferCommentController (route'lar gömülü; rate limit `write`)
| Method | Route | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/api/transfers/{transferId:guid}/comments` | public | — | 200 `{items:TransferCommentDto[]}` (like state ile) |
| POST | `/api/transfers/{transferId:guid}/comments` | auth | `{ content(≤2000), parentId? }` | 201 `{data:{commentId}}` / 404 |
| PUT | `/api/transfer-comments/{id:guid}` | auth | `{ content }` | 200 / 403 (sahip değil) / 404 |
| DELETE | `/api/transfer-comments/{id:guid}` | auth | — | 200 / 403 / 404 |
| POST | `/api/transfer-comments/{id:guid}/like` | auth | — | 200 / 404 |
| DELETE | `/api/transfer-comments/{id:guid}/like` | auth | — | 200 / 404 |

> Not: Transfer comment like/unlike **senkron** (200). Post comment like/unlike ise asenkron (202) — aşağı bak.

---

## SOSYAL (Post & Comment) — rate limit `write`

### PostController — `api/posts`
| Method | Route | Auth | Query/Body | Response |
|---|---|---|---|---|
| GET | `/api/posts/new-count` | public | `afterPostId` (zorunlu) | 200 `{count}` |
| GET | `/api/posts` | public* | filter: `playerId?, teamId?, ownerId?, search?, onlyFavourites=false, page=1, pageSize(≤100)` | 200 paged `PostDto` (*`onlyFavourites=true` ise auth gerekli → 401) |
| GET | `/api/posts/{id:guid}` | public | — | 200 `{data:PostDto}` (like state) / 404 |
| GET | `/api/posts/by-player/{playerId:guid}` | public | — | 200 `{items}` |
| GET | `/api/posts/by-team/{teamId:guid}` | public | — | 200 `{items}` |
| GET | `/api/posts/my` | auth | — | 200 `{items}` |
| POST | `/api/posts` | auth | `{ content(≤5000), postType, playerId?, teamId?, fromTeamId?, toTeamId?, isVotingEnabled }` | **202 Accepted** (kuyruğa alınır) / 400 (PostType shape) |
| POST | `/api/posts/{id:guid}/vote` | auth | `{ choice: PostVoteChoice }` | 200 `{data:PostVoteResult, unchanged?}` / 400 (voting kapalı) / 404 |
| PUT | `/api/posts/{id:guid}` | auth | `{ content(≤5000), playerId?, teamId?, fromTeamId?, toTeamId? }` | 200 / 403 / 404 |
| DELETE | `/api/posts/{id:guid}` | auth | — | 200 / 403 / 404 |
| POST | `/api/posts/{id:guid}/like` | auth | — | **202** (kuyruk) / 200 `{unchanged}` / 404 |
| DELETE | `/api/posts/{id:guid}/like` | auth | — | **202** / 200 `{unchanged}` / 404 |

### CommentController (route'lar gömülü)
| Method | Route | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/api/posts/{postId:guid}/comments` | public | — | 200 `{items:CommentDto[]}` (like state) |
| POST | `/api/posts/{postId:guid}/comments` | auth | `{ content(≤2000), parentId? }` | **202** (kuyruk) / 404 |
| PUT | `/api/comments/{id:guid}` | auth | `{ content }` | 200 / 403 / 404 |
| DELETE | `/api/comments/{id:guid}` | auth | — | 200 / 403 / 404 |
| POST | `/api/comments/{id:guid}/like` | auth | — | **202** (kuyruk) / 404 |
| DELETE | `/api/comments/{id:guid}/like` | auth | — | **202** / 404 |

---

## NEWS

### NewsController — `api/news` (public)
| Method | Route | Query | Response |
|---|---|---|---|
| GET | `/api/news` | `page=1, pageSize=20, sortBy=publishDate, order=desc` | 200 paged `NewsDto` |
| GET | `/api/news/{newsId:guid}` | — | 200 `{data}` / 404 |
| GET | `/api/news/by-player/{playerId:guid}` | `page, pageSize` | 200 paged |
| GET | `/api/news/by-team/{teamId:guid}` | `page, pageSize` | 200 (toTeam) |
| GET | `/api/news/from-team/{teamId:guid}` | `page, pageSize` | 200 (fromTeam) |
| GET | `/api/news/by-source` | `sourceName` (zorunlu), `page, pageSize` | 200 paged |
| GET | `/api/news/by-date-range` | `startDate, endDate` (zorunlu), `page, pageSize` | 200 paged |

---

## ADMIN — hepsi `[Authorize(Roles="Admin")]`, rate limit `write`

### AdminLeagueController — `api/admin/leagues`
| Method | Route | Body | Response |
|---|---|---|---|
| POST | `/api/admin/leagues` | `{ name, country, countryLogo, leagueLogo, leagueCode? }` | 201 `{data:{leagueId}}` |
| PUT | `/api/admin/leagues/{id:guid}` | (aynı) | 200 / 404 |
| DELETE | `/api/admin/leagues/{id:guid}` | — | 200 / 404 |

### AdminTeamController — `api/admin/teams`
| Method | Route | Body | Response |
|---|---|---|---|
| POST | `/api/admin/teams` | `{ name, logo?, leagueId }` | 201 `{data:{teamId}}` / 404 (lig) / 409 (isim çakışma) |
| PUT | `/api/admin/teams/{id:guid}` | (aynı) | 200 / 404 |
| DELETE | `/api/admin/teams/{id:guid}` | — | 200 / 404 |

### AdminPlayerController — `api/admin/players`
| Method | Route | Body | Response |
|---|---|---|---|
| POST | `/api/admin/players` | `{ firstName, lastName, nationality, birthDate?, height?, weight?, photo?, birthPlace?, birthCountry?, isFree, teamId, positionId? }` | 201 `{data:{playerId}}` / 404 (team/position) |
| PUT | `/api/admin/players/{id:guid}` | (aynı) | 200 / 404 |
| DELETE | `/api/admin/players/{id:guid}` | — | 200 / 404 |

### AdminNewsController — `api/admin/news`
| Method | Route | Body | Response |
|---|---|---|---|
| POST | `/api/admin/news` | `{ publishDate?, playerId?, fromTeamId?, toTeamId?, slug, imageUrl?, sourceName?, sourceUrl?, title, content }` | 201 `{newsId}` / 400 |
| PUT | `/api/admin/news/{newsId:guid}` | `{ newsId, ...(create alanları) }` | 200 / 400 (id mismatch) / 404 |
| DELETE | `/api/admin/news/{newsId:guid}` | — | 200 / 404 |
| DELETE | `/api/admin/news/bulk` | `{ ids: Guid[] }` (≤100) | 200 `{deletedCount}` / 400 |

### AdminTransferController — `api/admin/transfers`
| Method | Route | Body | Response |
|---|---|---|---|
| POST | `/api/admin/transfers` | `{ playerId, fromTeamId, toTeamId, transferDate, feeAmount, feeCurrency }` | 201 `{data:{transferId}}` / 404 / 409 (dup) — **bildirim tetikler. bot kullanır** |
| PUT | `/api/admin/transfers/{id:guid}` | (aynı) | 200 / 404 |
| PATCH | `/api/admin/transfers/{id:guid}` | `{ feeAmount?, feeCurrency?, transferDate? }` | 200 / 404 |
| DELETE | `/api/admin/transfers/{id:guid}` | — | 200 (soft delete) / 404 |

### AdminTransferPeriodController — `api/admin/transfer-periods`
| Method | Route | Query/Body | Response |
|---|---|---|---|
| GET | `/api/admin/transfer-periods` | `year?` | 200 `{items}` |
| GET | `/api/admin/transfer-periods/{id:guid}` | — | 200 `{data}` / 404 |
| POST | `/api/admin/transfer-periods` | `{ name, periodType?, startDate, endDate }` | 201 `{data:{transferPeriodId}}` / 400 (endDate≥startDate) |
| PUT | `/api/admin/transfer-periods/{id:guid}` | (aynı) | 200 / 400 / 404 |
| DELETE | `/api/admin/transfer-periods/{id:guid}` | — | 200 / 404 |

### Görsel Controller'ları (Admin) — hepsi multipart `image` (≤5MB) + `from-url`
Davranış: WebP'ye çevir, R2'ye yükle, `*LockedByAdmin` flag set; DELETE flag'i sıfırlar. Kalite: lig q90, takım q85, oyuncu q85, news q80, profil q80.

| Controller | Base | Endpoint'ler |
|---|---|---|
| LeagueImageController | `api/admin/leagues/{leagueId}/image` | POST, PUT, POST `/from-url` `{imageUrl}`, DELETE |
| TeamImageController | `api/admin/teams/{teamId}/image` | POST, PUT, POST `/from-url`, DELETE |
| PlayerImageController | `api/admin/players/{playerId}/image` | POST, PUT, POST `/from-url`, DELETE |
| NewsImageController | `api/admin/news/{newsId}/image` | POST, PUT, POST `/from-url`, DELETE |

Hepsi: 200 `{data:{url}}` / 400 (format/boyut) / 404 (entity) / 500.

### AdminSyncController — `api/admin/sync`
| Method | Route | Query | Response |
|---|---|---|---|
| POST | `/api/admin/sync/football-data` | — | **202** `{data:{jobId}}` (Hangfire job kuyruğa) |
| POST | `/api/admin/sync/football-data/leagues/{leagueExternalId:int}` | — | 202 `{data:{jobId, leagueExternalId}}` |
| GET | `/api/admin/sync/runs` | `take=20 (1-100)` | 200 `{items:SyncRunDto[]}` (audit: status/count/error/duration) |

### AdminSeedController — `api/admin/seed`
| Method | Route | Body | Response |
|---|---|---|---|
| POST | `/api/admin/seed/football-data` | multipart `file` (JSON, ≤50MB) | 200 `{data:SeedResult}` / 400 / 500 — `leagues_with_players.json` yükle, idempotent (ExternalId eşleşme), API key gerekmez |
