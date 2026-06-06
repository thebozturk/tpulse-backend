# faz-3b-core-transfer-rumour

> Faz 3 (Katalog+Search) 2/4. Kaynak: docs/02, docs/03. Transfer & Rumour **okuma** uçları + transfer-bağımlı katalog parçaları. stats/dashboard → **3b-stats**; player profile → **Faz 5** (posts bağımlılığı).

## Amaç

Transfer/rumour okuma uçları (soft-delete-aware) + lig/team/player transfer alt-uçları + team detail. Kart sıralaması `createdAt` (transferDate değil — docs nüansı).

## Alınan kararlar

- **Soft-delete-aware:** Transfer okumaları `EXTENDED_PRISMA` ile (`isDeleted:false` otomatik). Transfer uçları `isRumour:false`, rumour uçları `isRumour:true` ek filtre.
- **Ertelenenler:** stats, periods, period-summary, season-dashboard → **3b-stats** (currency: latest-rate + graceful fallback kararı orada uygulanır). player profile → **Faz 5**.
- **Default sort:** `createdAt desc` (mobil kart zamanı). `sort` query: `field`/`-field` whitelist (createdAt, transferDate, feeAmount).
- Tüm uçlar `@Public`.

## Endpoint'ler (docs/02)

### TransferQueryController — `api/transfers` (@Public)
- GET `/` filtre (playerId, fromTeamId, toTeamId, dateFrom, dateTo, feeMin, feeMax, currency, sort, page, pageSize≤100) → paged TransferDto
- GET `/:id` → `{data}` / 404
- GET `/latest` (take=10, page, pageSize) → paged
- GET `/top-expensive` (take=10, currency?, page, pageSize) → paged
- GET `/between-teams` (fromTeamId, toTeamId, includeReverse=false) → `{items}`
- GET `/by-year/:year` → `{items}`
- GET `/by-month/:year/:month` → `{items}`
- GET `/latest-by-leagues` (take=5, year?) → `{items: LeagueTransfersDto[]}`
> NOT route sırası: statik path'ler (`latest`, `top-expensive`, `between-teams`, `by-year`, `by-month`, `latest-by-leagues`) `:id`'den ÖNCE.

### RumourController — `api/rumours` (@Public, okuma)
- GET `/` filtre (playerId, fromTeamId, toTeamId, ownerId, dateFrom, dateTo, sort, page, pageSize=20) → paged RumourDto
- GET `/:id` → `{data}` / 404
- GET `/latest` (take=10, page, pageSize) → `{items}`
- GET `/by-player/:playerId` → `{items}`
- GET `/by-team/:teamId` → `{items}`
> create/update/delete/confirm → Faz 5/6 (notification bağımlı).

### Transfer-bağımlı katalog (mevcut modülleri genişlet)
- **leagues:** GET `/:leagueId/transfers` (year?, page, pageSize) · `/transfers/latest` (take=5, year?) · `/transfers/incoming` (filtre) · `/transfers/outgoing`
- **teams:** GET `/:id/detail` (TeamDetailDto: kadro + son 10 gelen/giden) · `/:teamId/incoming-transfers` · `/:teamId/outgoing-transfers` · `/:teamId/transfers` (gelen+giden)
- **players:** GET `/:playerId/transfers` · `/:playerId/last-transfer` (`{data}`/404)

## DTO'lar (docs/03 §5)

- **TransferDto** (zengin): id, player*(id/name/photo/nationality/positionName/teamId/teamName), fromTeam*(id/name/logo), toTeam*(id/name/logo), feeAmount, feeCurrency, transferDate, createdByUser*(id/username/photo/role)?, isRumour, source, createdAt, updatedAt?
- **RumourDto** = TransferDto ile aynı zengin şekil (rumour = isRumour:true transfer). Aynı mapper.
- **TeamTransferLineDto** (leaner — team/player/league transfer LİSTELERİ): transferId, playerId, playerName, playerPhoto?, fromTeamId, fromTeamName?, fromTeamLogo?, toTeamId, toTeamName?, toTeamLogo?, transferDate, feeAmount, feeCurrency, createdAt
- **TeamDetailDto:** id, name, logo?, founded?, venueName?, venueCity?, venueCapacity?, leagueId, leagueName, leagueLogo?, playerCount, squad: SquadPlayerDto[], recentIncoming: TeamTransferLineDto[], recentOutgoing: TeamTransferLineDto[]
- **SquadPlayerDto:** id, fullName, photo?, positionName?, nationality, isFree
- **LeagueTransfersDto:** league(id/name/logo) + transfers: TeamTransferLineDto[]
- **TransferFilterDto / RumourFilterDto:** docs/03 alanları + sort + paged (extends PaginationQueryDto)

## Repository (EXTENDED_PRISMA — soft-delete)

`TransfersModule` → `TRANSFER_REPOSITORY` (interface + `PrismaTransferRepository implements`, `@Inject(EXTENDED_PRISMA)`), **export**. Metodlar:
- query(filter, isRumour), getById(id, isRumour), getLatest, getTopExpensive, getBetweenTeams, getByYear, getByMonth, getLatestByLeagues
- getByLeagueId, getLeagueIncoming/Outgoing, getLatestByLeagueId
- getIncomingByTeamId, getOutgoingByTeamId, getAllByTeamId, getRecentByTeam(take)
- getByPlayerId, getLastByPlayerId
- (rumour) getRumours, getRumourById, getLatestRumours, getRumoursByPlayerId, getRumoursByTeamId

include: player(+position+team), fromTeam, toTeam, createdByUser. Soft-delete + isRumour filtreleri repo'da.

## Modül yapısı

```
src/transfers/  (transfer.repository + prisma-transfer.repository, transfer-query.controller,
                 rumour.controller, transfers.service, rumours.service, dto/, transfer.mapper)
                 TransfersModule exports TRANSFER_REPOSITORY
teams/   → TeamsModule imports TransfersModule; +team-transfers.controller, team detail TeamsService genişler
players/ → PlayersModule imports TransfersModule; +player-transfers.controller
leagues/ → LeaguesModule imports TransfersModule; +league-transfers.controller
```

## Kurallar

- Statik route'lar `:id`'den önce. `:id`/:teamId/:playerId/:leagueId `ParseUUIDPipe`. `:year`/`:month` `ParseIntPipe`.
- Sort whitelist (`@IsIn`). `between-teams` includeReverse boolean transform.
- Service HTTP bilmez; 404 typed exception. Repo soft-delete + isRumour'ı kapsüller.

## Test

- **Unit:** transfers.service (query → repo args + paged map, getById 404), rumours.service (isRumour:true geçişi), transfer.mapper (nested düzleştirme, createdBy null), teams.service detail (squad + recent map).
- **E2E (seed'li):** seed transfer (biri isDeleted, biri isRumour) → /transfers isDeleted'ı GÖSTERMEZ + isRumour'u GÖSTERMEZ; /rumours sadece isRumour; latest/top-expensive sıralama; team detail recent in/out; player last-transfer; 404/400.

## Doğrulama (docs/06 Faz 3 — 3b-core)

- [ ] /transfers soft-delete'i ve rumour'ları dışlar; /rumours sadece isRumour:true.
- [ ] Default sort createdAt desc; sort=field/-field çalışır.
- [ ] team /detail kadro + son 10 gelen/giden; player last-transfer.
- [ ] Envelope birebir; 404/400.
- [ ] tsc + lint + unit test temiz; seed'li e2e yeşil.

## Build sırası

1. TransfersModule: TransferRepository (EXTENDED_PRISMA) + DTO + mapper.
2. transfers.service + rumours.service.
3. TransferQueryController + RumourController.
4. Katalog genişletmeleri: team detail + team/player/league transfer controller'ları (TransfersModule import).
5. app.module + module wiring.
6. Unit + seed'li e2e + tsc + lint + commit.

## Sonraki

Faz 3b-stats — stats (12 alan agregasyon) + periods + period-summary + season-dashboard (CurrencyRate latest-rate + graceful fallback). Faz 3c — search (pg_trgm, bot).
