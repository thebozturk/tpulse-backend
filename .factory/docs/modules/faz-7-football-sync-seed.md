# faz-7-football-sync-seed

> Faz 7. Kaynak: docs/02-04. API-Football (api-sports.io v3) sync + JSON seed. Tek build. Key kullanıcıdan (canlı test).

## Amaç

Dış veri besleme: FootballDataClient (axios) + FootballDataSyncService (lig/takım/oyuncu upsert + oto-transfer + free-agent + görsel mirror + SyncRun audit) + FootballDataSeeder (JSON) + admin/sync & admin/seed uçları + BullMQ sync queue + cron.

## Kararlar

- **API:** `https://v3.football.api-sports.io`, header `x-apisports-key: ${API_FOOTBALL_KEY}` (RapidAPI gateway de desteklenir: `x-rapidapi-key`/`x-rapidapi-host`). Timeout 30s, retry 3 (429/5xx, exp backoff).
- **Key:** kullanıcı sağlar (canlı test). Client interface (IFootballDataClient) — unit'te mock.
- **Tek build** (seeder + sync + client + endpoints + cron birlikte).
- **Seed JSON şeması:** aşağıda tanımlı (leagues→teams→players). Pozisyonlar hardcoded EN/TR.
- Sync upsert anahtarı **externalId** (unique). Free-agent: asla hard-delete, `isFree=true`. Mirror: sadece `*SourceUrl` değişince + `*LockedByAdmin` ise atla.

## Paketler

`@nestjs/axios axios` (+ ImageMirror Faz 4'ten mevcut).

## Env (yeni)

```
API_FOOTBALL_KEY=                      # api-football.com dashboard key
API_FOOTBALL_BASE_URL=https://v3.football.api-sports.io
API_FOOTBALL_LEAGUE_IDS=39,140,135,78,61   # PL, LaLiga, SerieA, Bundesliga, Ligue1
API_FOOTBALL_SEASON=2024
SYNC_CRON=0 0 3 * * *                  # her gün 03:00 (opsiyonel; boşsa cron yok)
DETECT_TRANSFERS=false
MIRROR_IMAGES=false
```

## FootballDataClient (anti-corruption — IFootballDataClient + AxiosFootballDataClient)

api-sports v3 GERÇEK response → internal DTO eşleme (canlı smoke ile doğrulanacak):
- `getLeague` → `/leagues?id&season` → `response[].{league:{id,name,logo}, country:{name,flag}}` → `{externalId:league.id, name:league.name, leagueLogo:league.logo, country:country.name, countryLogo:country.flag}`
- `getTeamsByLeague` → `/teams?league&season` → `response[].{team:{id,name,logo,founded}, venue:{name,city,capacity}}` → `{externalId, name, logo, founded, venueName, venueCity, venueCapacity}`
- `getPlayersByTeam` → `/players?team&season&page` → `response[].{player:{id,firstname,lastname,nationality,birth:{date},height,weight,photo}, statistics[].games.position}` + `paging.total`. **height/weight string** ("178 cm"→178 parse), **position GENEL 4 tip** (Goalkeeper/Defender/Midfielder/Attacker — statistics[0].games.position).
- `getTransfersByTeam` → `/transfers?team` → `response[].{player:{id}, transfers[].{date, teams:{in:{id}, out:{id}}, type}}`. **fee serbest metin** ("€ 50M"/"Loan"/"N/A") → parse edilemezse feeAmount=0, feeCurrency=EUR.
HttpService (`@nestjs/axios`) + header `x-apisports-key` + rxjs `retry({count:3, delay: exp})` + `timeout(30000)`; 429/5xx retry. (RapidAPI gateway: `x-rapidapi-key`+`x-rapidapi-host`.)

## FootballDataSyncService

- `syncAll(season)`: configured LeagueIds → her biri syncLeague; tek SyncRun audit (toplam count'lar, status Success/Partial/Failed, durationMs).
- `syncLeague(leagueExtId, season)`:
  1. Position cache (hardcoded EN/TR map → Position upsert).
  2. League upsert (externalId). `LogoLockedByAdmin` değilse + sourceUrl değişince logo mirror.
  3. Teams (paginated yok, tek sayfa) upsert (externalId, leagueId). Logo mirror (guard'lı).
  4. Her takım: players (paginated) upsert (externalId, teamId, positionId). Photo mirror.
  5. (DetectTransfers) `/transfers` → doğru tarihli Transfer (Source=ApiSports), dedup (player,from,to,date).
  6. (Free-agent) senkronlanan liglerde hiçbir kadroda olmayan oyuncu → `isFree=true`.
  7. SyncRun kaydı.
- Upsert: `findUnique({externalId})` → varsa update (locked/sourceUrl guard'lı), yoksa create.

## FootballDataSeeder

`seed(jsonBuffer)` → parse → idempotent upsert (externalId). API key gerekmez. SeedResult {leaguesInserted/Updated, teamsInserted/Updated, playersInserted/Updated, positionsCreated}.

### Seed JSON şeması (`leagues_with_players.json`)
```json
{
  "leagues": [{
    "externalId": 39, "name": "Premier League", "country": "England",
    "countryLogo": "https://...", "leagueLogo": "https://...", "leagueCode": "PL",
    "teams": [{
      "externalId": 42, "name": "Arsenal", "logo": "https://...",
      "founded": 1886, "venueName": "Emirates", "venueCity": "London", "venueCapacity": 60704,
      "players": [{
        "externalId": 1460, "firstName": "Bukayo", "lastName": "Saka",
        "nationality": "England", "birthDate": "2001-09-05", "height": 178, "weight": 70,
        "photo": "https://...", "position": "Attacker"
      }]
    }]
  }]
}
```
**Pozisyon = api-sports genel 4 tip** (Goalkeeper/Defender/Midfielder/Attacker) → hardcoded EN/TR Position (seed + sync ortak map). Seed JSON ve canlı sync aynı pozisyon setini kullanır.

## Endpoint'ler (docs/02 — Admin, write throttle)

| Method | Route | Response |
|---|---|---|
| POST | `/api/admin/sync/football-data` | 202 `{data:{jobId}}` (BullMQ sync job — tüm ligler) |
| POST | `/api/admin/sync/football-data/leagues/:leagueExternalId` | 202 `{data:{jobId, leagueExternalId}}` |
| GET | `/api/admin/sync/runs?take=20` | 200 `{items:SyncRunDto[]}` (audit) |
| POST | `/api/admin/seed/football-data` | multipart `file` (JSON ≤50MB) → 200 `{data:SeedResult}` |

## Yapı

```
src/integration/api-football/
├─ football-data.client.ts        # IFootballDataClient + token
├─ axios-football-data.client.ts  # @nestjs/axios impl (retry/timeout)
├─ football-data.sync.service.ts  # syncAll/syncLeague + SyncRun
├─ football-data.seeder.ts        # JSON seed (idempotent)
├─ positions.ts                   # hardcoded EN/TR pozisyon map
├─ dto/ (sync-run.dto, seed-result.dto, external DTO'lar)
src/sync/
├─ sync.processor.ts (@Processor('sync')) + sync.module (BullMQ sync queue)
├─ admin-sync.controller.ts (admin/sync)
├─ admin-seed.controller.ts (admin/seed)
├─ sync.cron.ts (@Cron SYNC_CRON — opsiyonel)
```
BullModule.registerQueue('sync'). Sync repo'ları: PrismaService doğrudan (upsert) + SyncRun yazımı. ImageMirror inject.

## Test

- **Unit:** client maptest (api-sports response → DTO, retry), sync.service (upsert insert/update, free-agent işaretleme, mirror guard locked, SyncRun count), seeder (idempotent ikinci çalıştırma update, positions), admin-seed (büyük dosya / format).
- **E2E:** seed JSON upload → leagues/teams/players sayıları (idempotent 2. çalıştırma); admin/sync 202 + jobId → (mock veya canlı) job → SyncRun audit kaydı + GET runs. (Canlı: API_FOOTBALL_KEY ile gerçek lig.)

## Doğrulama (docs/06 Faz 7)

- [ ] seed yükle → lig/takım/oyuncu artıyor; idempotent (tekrar → update, duplicate yok).
- [ ] admin/sync 202 + jobId; sync job lig/takım/oyuncu upsert + SyncRun düşüyor.
- [ ] free-agent işaretleme; mirror locked/sourceUrl guard.
- [ ] GET runs audit.
- [ ] tsc + lint + unit + e2e (seed) temiz; canlı sync (key ile) smoke.

## Build sırası

1. Paketler + env + positions map.
2. FootballDataClient (interface + axios impl).
3. SyncRun audit + FootballDataSyncService (upsert/free-agent/mirror).
4. FootballDataSeeder + seed JSON şema/örnek.
5. SyncModule: BullMQ sync queue + processor + cron + admin-sync/admin-seed controller.
6. app.module wiring + unit + e2e + (canlı smoke) + commit.

## Sonraki

Faz 8 — Hardening: idempotency interceptor, rate-limit named policy (auth/write), OpenTelemetry, forwarded headers, tam regresyon paritesi.
