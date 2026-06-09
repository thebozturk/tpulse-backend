# Yük Testi (k6)

TransferPulse backend için k6 tabanlı yük testi altyapısı. Lokal docker-compose
üzerinde ayağa kalkan tam stack'e (API + Postgres + Redis) karşı koşar.

## Önkoşul: rate limit bypass

API'de global **300/dk/IP** + route policy'leri (auth 30/dk, write 120/dk) var.
Yük testi bunlara takılmasın diye `LOAD_TEST_MODE=true` ile **rate limit bypass**
edilir (`LoadAwareThrottlerGuard`). Bu flag **sadece non-prod**'da geçerli —
`NODE_ENV=production` + `LOAD_TEST_MODE=true` boot'ta fail eder.

`docker-compose.loadtest.yml` overlay'i bunu otomatik açar.

## Hızlı başlangıç (Docker — k6 kurmaya gerek yok)

```bash
# Stack + seed + smoke (k6 grafana/k6 image'ından)
docker compose -f docker-compose.yml -f docker-compose.loadtest.yml up -d --build postgres redis api
pnpm db:deploy && pnpm db:seed          # discovery için veri
docker compose -f docker-compose.yml -f docker-compose.loadtest.yml --profile loadtest run --rm k6

# Başka senaryo:
docker compose -f docker-compose.yml -f docker-compose.loadtest.yml --profile loadtest \
  run --rm k6 run /load/scenarios/public-read.js
```

## Lokal k6 ile (host'a kurulu)

```bash
brew install k6                          # macOS
# API'yi LOAD_TEST_MODE=true ile çalıştır (örn. .env'de LOAD_TEST_MODE=true)
pnpm load:smoke                          # CI gate senaryosu
pnpm load:baseline                       # public read — normal yük
pnpm load:stress                         # public read — ağır yük (STAGE=stress)
pnpm load:write                          # auth + favori yazma akışı
pnpm load:spike                          # ani yük
pnpm load:soak                           # uzun süreli (default 30m)
```

`BASE_URL` ile hedef değişir (default `http://localhost:8080`):

```bash
BASE_URL=http://localhost:8080 k6 run load/scenarios/smoke.js
```

## Senaryolar

| Dosya                      | Amaç                                          |
|----------------------------|-----------------------------------------------|
| `scenarios/smoke.js`       | CI gate — düşük VU, ~1dk, kritik endpoint'ler |
| `scenarios/public-read.js` | news/transfers/players/teams/leagues/search   |
| `scenarios/auth-write.js`  | login + favori ekleme/listeleme (idempotent)  |
| `scenarios/spike.js`       | 0→300→0 ani yük toleransı                      |
| `scenarios/soak.js`        | sabit orta yük, uzun süre (leak/pool tespiti) |

## Yapı

- `lib/config.js` — **tek kaynak**: `BASE_URL`, threshold/SLO, ramp stage'leri
- `lib/auth.js` — test kullanıcısı register + token
- `lib/data.js` — `setup()`'ta list endpoint'lerinden **gerçek id** çekme (hardcode yok)
- `lib/checks.js` — ortak `check` + think-time + rastgele seçim
- `profiles.js` — ramping / constant executor üreticileri

## Threshold (SLO)

`lib/config.js` içinde tanımlı, k6 `thresholds`'a verilir. İhlal → **exit≠0** →
CI kırılır. Örn. read: `http_req_failed<1%`, `p95<500ms`, `p99<1200ms`.

## Çıktı / rapor

`--summary-export=load-results/<senaryo>.json` ile JSON özet (`load-results/`
gitignore'da). Terminal'de k6 default özeti basılır. Detaylı zaman serisi için
`--out json=load-results/raw.json` eklenebilir.

## CI

`.github/workflows/load-smoke.yml` her PR'da `smoke` senaryosunu koşar; threshold
aşılırsa pipeline kırılır, k6 özeti artifact olarak yüklenir.
