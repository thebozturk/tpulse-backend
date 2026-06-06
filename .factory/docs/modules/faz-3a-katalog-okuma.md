# faz-3a-katalog-okuma

> Faz 3 (Katalog+Search) 1/3. Kaynak: docs/02, docs/03 §4-5. Bu alt-faz **transfer-bağımsız** katalog okumalarını kapsar; transfer'e bağlı parçalar (team detail, player profile, lig/oyuncu/takım transferleri, stats, search) Faz 3b/3c'ye.

## Amaç

leagues / teams / players / news **public okuma** uçları + **Repository soyutlama katmanının** kurulması (karar: Faz 3). DTO şekilleri ve sayfalama/filtre davranışı docs/02-03 ile birebir.

## Alınan teknik kararlar (Faz 3 geneli)

- **Repository abstraction:** docs/03 `I*Repository`'leri gerçek provider. Interface (token) + `Prisma*Repository implements I*` (PrismaService inject) + `{ provide: TOKEN, useClass }`. Servis `@Inject(TOKEN)` ile interface'e bağımlı. Metodlar faz faz eklenir (3a subset, 3b genişletir).
- **Alt-fazlar:** 3a katalog (bu) → 3b transfer/rumour/stats + transfer-bağımlı katalog parçaları → 3c search.
- **Faz 2 retrofit (opsiyonel):** Tutarlılık için UsersService sonradan `IUserRepository`'ye taşınabilir — bu alt-fazı bloklamaz, ayrı cleanup.
- Tüm uçlar `@Public()` (global JwtAuthGuard bypass). Mutating yok → throttle default (300/dk) yeterli.

## Kapsam — endpoint'ler (docs/02 birebir)

### LeagueController — `api/leagues` (@Public)
| Method | Route | Response |
|---|---|---|
| GET | `/api/leagues?page&pageSize` | 200 paged LeagueDto |
| GET | `/api/leagues/:id` | 200 `{data:LeagueDto}` / 404 |
| GET | `/api/leagues/by-code/:code` | 200 `{data}` / 404 |
> Lig transferleri (`/:leagueId/transfers/*`) → 3b (TransferRepository gerekir).

### TeamController — `api/teams` (@Public)
| GET | `/api/teams?page&pageSize` | 200 paged TeamDto |
| GET | `/api/teams/:id` | 200 `{data:TeamDto}` / 404 |
| GET | `/api/teams/by-league/:leagueId` | 200 `{items:TeamDto[]}` |
> `/:id/detail` (kadro + son transferler) ve team-transfers → 3b.

### PlayerController — `api/players` (@Public)
| GET | `/api/players?teamId&nationality&positionId&isFree&search&page&pageSize` | 200 paged PlayerDto |
| GET | `/api/players/:id` | 200 `{data:PlayerDto}` / 404 |
| GET | `/api/players/by-team/:teamId` | 200 `{items}` |
| GET | `/api/players/by-nationality/:nationality` | 200 `{items}` |
| GET | `/api/players/free-agents` | 200 `{items}` |
> `/profile`, `/search`, player-transfers → 3b/3c.

### NewsController — `api/news` (@Public) — TAM (transfer-bağımsız)
| GET | `/api/news?page&pageSize&sortBy=publishDate&order=desc` | 200 paged NewsDto |
| GET | `/api/news/:newsId` | 200 `{data}` / 404 |
| GET | `/api/news/by-player/:playerId` | 200 paged |
| GET | `/api/news/by-team/:teamId` | 200 paged (toTeam) |
| GET | `/api/news/from-team/:teamId` | 200 paged (fromTeam) |
| GET | `/api/news/by-source?sourceName&page&pageSize` | 200 paged |
| GET | `/api/news/by-date-range?startDate&endDate&page&pageSize` | 200 paged |

## DTO'lar (docs/03 §5)

- **LeagueDto:** id, name, country, countryLogo, leagueLogo, leagueCode?, **teamCount** (agg)
- **TeamDto:** id, name, logo?, leagueId, **leagueName**, **playerCount** (agg)
- **PlayerDto:** id, firstName, lastName, **fullName** (computed), nationality, birthDate?, height?, weight?, photo?, birthPlace?, birthCountry?, isFree, teamId, **teamName**, teamLogo?, positionId?, **positionName**
- **NewsDto:** newsId, publishDate, player*(id/name/nationality/photo)?, fromTeam*(id/name/logo)?, toTeam*(id/name/logo)?, slug, imageUrl?, sourceName?, sourceUrl?, title, content
- **PlayerFilterDto:** teamId?, nationality?, positionId?, isFree?, search?, page=1, pageSize=20 (extends PaginationQueryDto)
- **NewsQueryDto:** page, pageSize, sortBy(default publishDate), order(asc|desc default desc)

> Response envelope: tekil `{data}`, sayfalama `{items,page,pageSize,totalCount,totalPages}` (buildPaged), sayfasız liste `{items}`. fullName = `firstName + ' ' + lastName` (mapper'da).

## Dosya yapısı

```
src/leagues/
├─ leagues.module.ts
├─ leagues.controller.ts
├─ leagues.service.ts
├─ league.repository.ts        # ILeagueRepository + LEAGUE_REPOSITORY token
├─ prisma-league.repository.ts # implements ILeagueRepository
├─ dto/league-response.dto.ts
└─ league.mapper.ts
src/teams/ (… aynı düzen: team.repository, prisma-team.repository, dto, mapper)
src/players/ (… player.repository, prisma-player.repository, player-filter.dto, dto, mapper)
src/news/ (… news.repository, prisma-news.repository, news-query.dto, dto, mapper)
src/common/repository/  (opsiyonel: ortak repo helper'ları)
```

## Repository pattern (örnek — League)

```ts
export const LEAGUE_REPOSITORY = Symbol('LEAGUE_REPOSITORY');
export interface ILeagueRepository {
  getAll(page: number, pageSize: number): Promise<{ items: LeagueWithCount[]; total: number }>;
  getById(id: string): Promise<LeagueWithCount | null>;
  getByCode(code: string): Promise<LeagueWithCount | null>;
}
// prisma-league.repository.ts: PrismaService inject, _count: { teams } ile teamCount
// module: { provide: LEAGUE_REPOSITORY, useClass: PrismaLeagueRepository }
// service: constructor(@Inject(LEAGUE_REPOSITORY) private repo: ILeagueRepository)
```
Agg alanları (teamCount/playerCount) Prisma `_count`; teamName/positionName/leagueName `include`. Mapper Prisma tipini DTO'ya düzleştirir.

## Kurallar (rules/api.md)

- Her uçta `@ApiOperation` + `@ApiResponse`. `@Public()`. Controller `@ApiTags`.
- Query `@Query() dto` (raw destructuring yok). `:id` `ParseUUIDPipe`. Path noun-based.
- `findById` userId-less OK — public katalog, broken-access riski yok (warning beklenir).
- Service HTTP bilmez; NotFound → controller veya service typed exception.

## Test

- **Unit (her servis):** repo mock'la → list paged map, getById 404 (null→NotFoundException), filter geçişi (PlayerFilter → repo args), mapper computed alanlar (fullName, teamCount).
- **Mapper unit:** PlayerDto.fullName, NewsDto nested düzleştirme.
- **E2E (infra'lı, seed ile):** seed birkaç league/team/player/news → GET list/detail/by-* doğru şekil + 404; pageSize>100 clamp.

## Doğrulama (docs/06 Faz 3 — 3a dilimi)

- [ ] GET list/detail/by-* uçları docs/02 şekillerini döndürüyor (envelope birebir).
- [ ] Sayfalama `{items,page,pageSize,totalCount,totalPages}`; pageSize ≤100 clamp.
- [ ] 404 davranışı (geçersiz id).
- [ ] teamCount/playerCount/teamName/positionName doğru (agg/include).
- [ ] `tsc` + `lint` + unit test temiz; e2e (seed ile) yeşil.

## Build sırası

1. Repository pattern iskeleti (token + interface + Prisma impl) — League ile başla, diğerlerine kopyala.
2. DTO + mapper (4 modül).
3. Repository impl'leri (Prisma include/_count).
4. Service'ler (repo inject, paged/404/filter).
5. Controller'lar (@Public, @ApiOperation, Query DTO, ParseUUIDPipe).
6. Module'lar + app.module import.
7. Unit + e2e + tsc + lint + commit.

## Sonraki

Faz 3b — transfers/rumours (okuma) + stats/period-summary/season-dashboard (currency conversion) + transfer-bağımlı katalog parçaları (team detail, player profile, league/team/player transfer uçları). Faz 3c — search (pg_trgm, bot sözleşmesi).
