# load-testing

## Amaç

Backend için **k6 tabanlı yük testi altyapısı**. Lokal docker-compose üzerinde
ayağa kaldırılan tam stack'e (NestJS + Postgres + Redis + BullMQ) karşı
tekrarlanabilir senaryolar koşar; threshold (SLO) ihlalinde exit≠0 döner.

Hedefler:
- Public read endpoint'lerinin yük altındaki davranışını ölçmek (p95/p99, hata oranı)
- Auth + yazma akışlarını gerçekçi token yönetimiyle test etmek
- Spike (ani yük) ve soak (uzun süreli) dayanıklılığı doğrulamak
- CI'da hafif bir smoke load gate ile regresyonu yakalamak

**Araç:** Grafana k6 · **Konum:** repo kökünde `load/` · **Ortam:** lokal docker-compose
· **Raporlama:** sade (terminal summary + JSON/HTML artifact, ekstra servis yok).

## Kapsam (scope)

Dahil:
- 5 senaryo: smoke, public-read, auth-write, spike, soak
- Ortak k6 lib (config, auth, data discovery, checks)
- Backend'e `LOAD_TEST_MODE` env + rate-limit bypass (aşağıda)
- docker-compose `loadtest` profile (one-shot k6 servisi)
- package.json `load:*` scriptleri
- GitHub Actions smoke gate workflow

Dahil DEĞİL (scope creep):
- Grafana/InfluxDB canlı dashboard (sonra ayrı iş)
- OTel/Prometheus remote-write entegrasyonu (sonra)
- Production/staging ortamına yük testi (bu spec sadece lokal)
- Distributed/cloud k6 (k6 Cloud)

## Backend değişikliği — rate-limit bypass

Mevcut throttle: global **300/dk/IP** + isimli policy'ler (`auth` 30/dk, `write`
120/dk, `adminBulk` 10/dk — `src/common/throttle/throttle-policies.ts`). Bu
limitler yük testini duvara çarptırır. Çözüm: env-driven bypass.

1. **Env**: `src/config/env.validation`'a `LOAD_TEST_MODE` (boolean, default `false`).
   - **Guard**: `NODE_ENV=production` iken `LOAD_TEST_MODE=true` olursa startup'ta
     throw (prod'da asla bypass açılamaz).
2. **ThrottlerGuard subclass**: `LoadAwareThrottlerGuard extends ThrottlerGuard`
   - `LOAD_TEST_MODE=true` → `canActivate()` doğrudan `true` döner (bypass).
   - aksi halde `super.canActivate()`.
   - `app.module.ts`'te `APP_GUARD` olarak mevcut `ThrottlerGuard` yerine bu geçer.
3. **.env.example**: `LOAD_TEST_MODE=false` satırı eklenir (açıklamalı).

Not: bypass yalnızca rate limit içindir; auth/validation/guard zinciri aynen
çalışır — gerçekçi yük ölçümü korunur.

## Dizin yapısı

```
load/
├── lib/
│   ├── config.js        # BASE_URL (env), ortam, threshold/SLO sabitleri
│   ├── auth.js          # register→login→token helper (setup'ta çağrılır)
│   ├── data.js          # setup'ta GET list endpoint'lerinden gerçek id toplama
│   └── checks.js        # ortak response check'leri (status, body shape, latency)
├── scenarios/
│   ├── smoke.js         # CI gate: düşük VU (~5), ~1dk, tüm kritik endpoint 1 kez
│   ├── public-read.js   # ağırlıklı GET karışımı (news/transfers/players/teams/leagues/search)
│   ├── auth-write.js    # login + comment/favourite/report yazma akışı
│   ├── spike.js         # ramp 0→yüksek→0, ani yük toleransı
│   └── soak.js          # sabit yük uzun süre (memory/connection pool sızıntısı)
├── profiles.js          # executor + stage tanımları (env STAGE: baseline|stress)
└── README.md            # nasıl çalıştırılır, threshold yorumu, troubleshooting
```

## Test edilecek endpoint'ler (gerçek route'lar)

Hepsi `api/` prefix'li (global prefix YOK; controller'lar `api/...` ile başlar).

Public read (ana yük):
- `GET api/news`, `api/news/by-date-range`, `api/news/:newsId`
- `GET api/transfers`, `api/transfers/latest`, `api/transfers/top-expensive`,
  `api/transfers/by-year/:year`
- `GET api/players`, `api/players/search?q=`, `api/players/:id/profile`
- `GET api/teams`, `api/teams/:id/detail`, `api/teams/:teamId/transfers`
- `GET api/leagues`, `api/leagues/:leagueId/transfers/latest`
- `GET api/search?q=`
- `GET health` (warm-up / liveness)

Auth + write:
- `POST api/auth/register`, `POST api/auth/login`, `POST api/auth/refresh`
- yazma uçları (örn. `comment` / `favourite` / `report`) — token'lı, `write` policy

## Senaryolar ve SLO threshold'ları

| Senaryo      | Executor / yük                       | Threshold (SLO) |
|--------------|--------------------------------------|-----------------|
| smoke        | constant-vus ~5, 1dk                 | `http_req_failed<1%`, `checks>99%`, p95<800ms |
| public-read  | ramping-vus baseline/stress (STAGE)  | `http_req_failed<1%`, p95<500ms, p99<1200ms |
| auth-write   | ramping-vus orta                     | `http_req_failed<1%`, p95<800ms, `checks>99%` |
| spike        | ramping 0→peak→0                     | spike sırasında `http_req_failed<5%`, recovery p95<1000ms |
| soak         | constant uzun süre (örn. 30dk)       | süre boyunca `http_req_duration` trend sabit, `http_req_failed<1%` |

Threshold'lar k6 `thresholds` ile tanımlı → ihlalde k6 exit≠0 → CI kırılır.
Sabit değerler `load/lib/config.js`'te tek yerde; senaryolar oradan okur (magic
number yok).

## Test verisi

- `pnpm db:seed` (mevcut Prisma seed) ortamı besler.
- k6 `setup()` aşamasında list endpoint'lerinden (`api/players`, `api/teams`,
  `api/leagues`, `api/transfers`) gerçek id'ler çekilir ve VU'lara dağıtılır.
- **Hardcoded id YOK** — ortam değişse de senaryolar kırılmaz.
- auth-write için `setup()` bir test kullanıcısı register/login eder, token'ı
  paylaşır (veya küçük bir token havuzu).

## docker-compose

`docker-compose.yml`'a `loadtest` profile (varsayılan `up`'ta gelmez):

```yaml
  k6:
    image: grafana/k6:latest
    profiles: ["loadtest"]
    network_mode: service:backend   # veya aynı compose network
    environment:
      - BASE_URL=http://backend:3000
      - STAGE=baseline
    volumes:
      - ./load:/load
    entrypoint: ["k6", "run", "/load/scenarios/public-read.js"]
```

Backend test ortamında `LOAD_TEST_MODE=true` ile başlatılır (override compose
veya env). Prod compose'a DOKUNULMAZ.

## package.json scriptleri

```
"load:smoke":    "k6 run load/scenarios/smoke.js",
"load:baseline": "STAGE=baseline k6 run load/scenarios/public-read.js",
"load:stress":   "STAGE=stress k6 run load/scenarios/public-read.js",
"load:spike":    "k6 run load/scenarios/spike.js",
"load:soak":     "k6 run load/scenarios/soak.js"
```

`BASE_URL` env ile hedef belirlenir (default `http://localhost:3000`).

## CI gate (GitHub Actions)

`.github/workflows/load-smoke.yml`:
1. compose ile stack ayağa kalkar (`LOAD_TEST_MODE=true`, seed çalışır)
2. health endpoint hazır olana dek bekle (warm-up)
3. `k6 run load/scenarios/smoke.js`
4. threshold ihlali → k6 exit≠0 → job fail
5. k6 JSON/HTML summary artifact olarak yüklenir

(ci-cd skill: `.factory/skills/devops/ci-cd.md` — workflow yapısı oradan.)

## Kurallar / kısıtlar

- k6 senaryoları **JS** (TS değil) — k6 kendi runtime'ı.
- Threshold'lar tek kaynak: `load/lib/config.js`.
- Latency assertion için k6 `check` + `thresholds` ikisi de — check başarısızlığı
  da raporlanır.
- Yazma senaryoları **idempotent veya temizlenebilir** veri üretir (soak'ta DB
  şişmesini önle; gerekiyorsa teardown'da cleanup).
- Bypass yalnızca rate limit; auth/validation aynen çalışır.
- Hardcoded URL yok — `BASE_URL` env.

## Test (altyapının kendi doğrulaması)

- Backend: `LoadAwareThrottlerGuard` unit test — `LOAD_TEST_MODE=true`'da bypass,
  `false`'ta `super` çağrısı; prod+true'da config validation throw.
- Smoke senaryosu lokal compose'da yeşil geçmeli (manuel kabul).

## Dependencies

- **k6** — host'a kurulu (`brew install k6`) veya `grafana/k6` docker image
  (kod bağımlılığı yok, pnpm paketi eklenmez).
- Backend tarafı: yeni paket YOK (`@nestjs/throttler` zaten var).

## Env variables

```env
# Load testing (sadece non-prod; prod'da true YASAK — startup throw)
LOAD_TEST_MODE=false

# k6 hedefi (script tarafı, .env'e gerek yok ama README'de belgeli)
# BASE_URL=http://localhost:3000
# STAGE=baseline   # baseline | stress
```

## Build order

1. Backend: `LOAD_TEST_MODE` env validation + prod guard
2. Backend: `LoadAwareThrottlerGuard` + app.module APP_GUARD swap + guard unit test
3. `load/lib/` (config, auth, data, checks)
4. `load/scenarios/` (smoke → public-read → auth-write → spike → soak)
5. `load/profiles.js` + `load/README.md`
6. docker-compose `loadtest` profile + package.json `load:*` scriptleri
7. `.github/workflows/load-smoke.yml`
8. `.env.example` güncelle

Build komutu: `/build load-testing`
Tahmini: ~14 yeni dosya, 4 değişim (app.module, env.validation, docker-compose,
package.json, .env.example).
