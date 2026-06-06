# faz-3c-search

> Faz 3 (Katalog+Search) 4/4. Kaynak: docs/02, docs/03 §4. pg_trgm fuzzy search. **Bot sözleşmesi kritik:** `/api/search`, `/api/players/search`.

## Amaç

pg_trgm tabanlı fuzzy arama: `/api/search` (player/team/league birleşik) + `/api/players/search` (paged). Bot bu uçları kullanır — şekil korunmalı.

## Kararlar

- **pg_trgm** (Faz 1'de extension eklendi). Performans için **GIN trigram index'leri** migration ile (bot perf).
- Eşleştirme: substring (ILIKE) VEYA trigram benzerliği (`%`/`similarity`), `similarity DESC` sıralama.
- Raw SQL **`$queryRaw` + `Prisma.sql`** (parameterized — injection yok; `$queryRawUnsafe` YASAK, security-gate). Player ismi `firstName||' '||lastName`.
- Search read-only katalog → soft-delete/transfer ilgisiz; base `PrismaService`.

## Endpoint'ler (docs/02)

- GET `/api/search?q&limit=5` (@Public) → `{ query, data: { players[], teams[], leagues[] } }` / 400 (q boş). Her item: `SearchResultItemDto { type, id, name, imageUrl?, subtitle? }`.
- GET `/api/players/search?query&page&pageSize(1-50 clamp)` (@Public, PlayersController'da, :id'den ÖNCE) → paged PlayerResponseDto / 400.

## DTO'lar

- **SearchResultItemDto:** type('player'|'team'|'league'), id, name, imageUrl?, subtitle?
- **SearchResultsDto:** players[], teams[], leagues[]
- **SearchResponseDto:** query, data: SearchResultsDto
- **SearchQueryDto:** q (required, non-empty, max), limit (default 5, 1-20)
- **PlayerSearchDto:** query (required), page, pageSize (1-50 clamp)

## Yapı

```
src/search/
├─ search.repository.ts        # ISEARCH_REPOSITORY: searchPlayers/Teams/Leagues + searchPlayersPaged
├─ prisma-search.repository.ts # $queryRaw + Prisma.sql (pg_trgm)
├─ search.service.ts
├─ search.controller.ts        # /api/search
├─ search.module.ts            # exports SearchService
└─ dto/ (search-result, search-query)
players/ → PlayersModule imports SearchModule; PlayersController +/search (SearchService)
```

## Migration (GIN trigram index)

```sql
CREATE INDEX IF NOT EXISTS team_name_trgm ON "team" USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS league_name_trgm ON "league" USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS player_first_trgm ON "player" USING gin ("firstName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS player_last_trgm ON "player" USING gin ("lastName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS player_full_trgm ON "player" USING gin (("firstName" || ' ' || "lastName") gin_trgm_ops);
```
`prisma migrate dev --create-only` → SQL ekle → uygula. (Prisma şemada index var ama gin_trgm_ops ifade edilemez → raw migration.)

## Repository (örnek — team)

```sql
SELECT id, name, logo, similarity(name, ${q}) AS sim
FROM "team"
WHERE name ILIKE '%' || ${q} || '%' OR name % ${q}
ORDER BY sim DESC, name ASC
LIMIT ${limit}
```
Prisma.$queryRaw<Row[]>`...` ile. Player: `("firstName"||' '||"lastName")` üzerinde. searchPlayersPaged ayrıca COUNT(*).

## Test

- **Unit:** search.service (q boş → 400, result gruplama), player-search clamp.
- **E2E (seed'li):** "Ars" → team Arsenal; "Sak" → player Saka; fuzzy "Arsneal" → Arsenal (trigram); /players/search paged; q boş 400; pageSize>50 clamp.

## Doğrulama

- [ ] /api/search şekli `{query, data:{players,teams,leagues}}`; q boş 400.
- [ ] /api/players/search paged, pageSize 1-50 clamp.
- [ ] Fuzzy (typo) eşleşmesi çalışır; GIN index migration uygulandı.
- [ ] tsc + lint + unit + e2e temiz.

## Build sırası

1. Migration (GIN trigram).
2. DTO + SearchRepository ($queryRaw) + impl.
3. SearchService + SearchController + SearchModule.
4. PlayersController +/search + PlayersModule import + app.module import SearchModule.
5. Unit + seed'li e2e + tsc + lint + commit.

## Sonraki

Faz 3 TAMAM. → Faz 4 (Storage R2 + sharp + Admin CRUD + görsel controller'ları).
