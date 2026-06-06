# faz-3b-stats-dashboard

> Faz 3 (Katalog+Search) 3/4. Kaynak: docs/02, docs/03. Transfer agregasyonları: stats + periods + period-summary + season-dashboard (CurrencyRate çevrimi).

## Amaç

`/api/transfers` altındaki agregasyon uçları: stats (12 alan), periods (TransferPeriod read), period-summary + season-dashboard (baseCurrency çevrimi). Soft-delete-aware (EXTENDED_PRISMA, isRumour:false).

## Alınan kararlar

- **Currency conversion:** latest-rate + graceful fallback. CurrencyConverter: para birimi çiftine göre EN SON `CurrencyRate`; rate yoksa **1:1 (base kabul)** + warning log. CurrencyRate boş olsa bile çalışır.
- **stats raw agregasyon:** stats fee toplamları ham (currency filtresi daraltır); conversion SADECE period-summary/season-dashboard'da.
- latest/earliest = `createdAt` (kart zamanı). Tüm uçlar `@Public`, statik route'lar `:id`'den ÖNCE (aynı controller'a eklenecek).

## Endpoint'ler (TransferQueryController'a eklenir — :id'den önce)

- GET `/api/transfers/stats` (filter: playerId, teamId, dateFrom, dateTo, currency, year, month, transferPeriodId) → TransferStatsDto
- GET `/api/transfers/periods` (year?) → `{items: TransferPeriodDto[]}` / 400 (year 1900..now+1)
- GET `/api/transfers/period-summary` (year? VEYA transferPeriodId?, baseCurrency=EUR) → TransferPeriodSummaryDto / 400 (biri zorunlu)
- GET `/api/transfers/season-dashboard` (year?/transferPeriodId?, baseCurrency=EUR, topN=5 (1-20)) → TransferSeasonDashboardDto / 400

## DTO'lar (docs/03)

- **TransferStatsDto:** totalTransfers, totalSpent, averageFee, maxFee, minFee, mostExpensiveTransfer?, latestTransfer?, earliestTransfer? (TeamTransferLineDto), mostActiveBuyerTeam?, mostActiveSellerTeam? ({teamId,teamName,count}), mostTransferredPlayer? ({playerId,playerName,count}), highestFeePlayer? ({playerId,playerName,feeAmount})
- **TransferPeriodDto:** id, name, periodType?, startDate, endDate
- **TransferPeriodSummaryDto:** period(name/start/end veya year), baseCurrency, totalTransfers, totalSpent(base), topTransfers: TeamTransferLineDto[] (fee base'e çevrilmiş)
- **TransferSeasonDashboardDto:** baseCurrency, year/period, totalTransfers, totalSpent(base), topN, topTransfers: TeamTransferLineDto[], topSpenders: {teamId,teamName,total}[]
> NOT: period-summary/season-dashboard tam şekli docs'ta net değil — makul tasarım, .NET diff'inde doğrulanacak.

## Yapı

```
src/transfers/stats/
├─ stats.repository.ts        # ISTATS_REPOSITORY: aggregate/groupBy/period sorguları
├─ prisma-stats.repository.ts # EXTENDED_PRISMA inject
├─ currency-converter.ts      # CurrencyConverter (latest-rate + 1:1 fallback)
├─ stats.service.ts           # orkestrasyon + conversion
└─ dto/ (transfer-stats, transfer-period, period-summary, season-dashboard)
```
TransfersModule: StatsService + STATS_REPOSITORY + CurrencyConverter provider. TransferQueryController StatsService inject eder (4 uç :id'den önce).

## Repository (aggregate/groupBy)

- getStats(where): prisma.transfer.aggregate (_count, _sum/_avg/_max/_min feeAmount) + mostExpensive (orderBy fee desc take 1, include) + latest/earliest (orderBy createdAt) + groupBy(toTeamId)/(fromTeamId)/(playerId) → top1 + isim resolve.
- getPeriods(year?): TransferPeriod where startDate yıl içinde, orderBy startDate.
- getPeriodById(id): TransferPeriod.
- getInRange(start, end): transfer listesi (period-summary/dashboard top + toplam için).
- where: isRumour:false (+ extended soft-delete). teamId → OR(from/to). year/month/transferPeriodId → transferDate range.

## CurrencyConverter

`convert(amount, from, to=base): number` — from==to → amount; else en son `CurrencyRate` (currencyCode=from, baseCurrencyCode=to, max rateDate) → amount*rate; yoksa **amount (1:1)** + `logger.warn`. Rate'leri startup'ta veya lazy cache'le.

## Test

- **Unit:** currency-converter (1:1 fallback, rate ile çevrim), stats.service (aggregate map, year→range, teamId→OR, period 400), repository aggregate where.
- **E2E (seed'li):** çok transfer + 1 deleted + 1 rumour → stats sadece aktif non-rumour'ı sayar; max/min/avg doğru; mostActiveBuyer; periods year filtresi + 400; period-summary year ile totalSpent; season-dashboard topN.

## Doğrulama (docs/06 Faz 3 — stats dilimi)

- [ ] stats soft-delete + rumour'ı dışlar; 12 alan dolu/doğru.
- [ ] periods year-out-of-range 400; period-summary biri zorunlu yoksa 400.
- [ ] CurrencyRate boşken 1:1 fallback çalışır (warn); rate eklenince çevirir.
- [ ] tsc + lint + unit + e2e temiz.

## Build sırası

1. CurrencyConverter + stats DTO'ları.
2. StatsRepository (aggregate/groupBy/period) + impl.
3. StatsService.
4. TransferQueryController'a 4 uç (:id'den önce) + TransfersModule provider'ları.
5. Unit + seed'li e2e + tsc + lint + commit.

## Sonraki

Faz 3c — search (pg_trgm: /api/search, /api/players/search — bot sözleşmesi).
