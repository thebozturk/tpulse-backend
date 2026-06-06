# faz-8-hardening

## Amaç

Prod-hazırlık + .NET davranış paritesi. Bu fazda **idempotency**, **isimlendirilmiş rate-limit policy'leri** ve **otomatik route-parite testi + parite raporu** eklenir. OpenTelemetry kullanıcı kararıyla **ayrı bir mini-faza ertelendi** (Faz 8b). İki-process ayrımı proje kararı (tek process) gereği **kapsam dışı**.

Kaynak: `docs/00-OVERVIEW §7`, `docs/02` (uç listesi), `docs/04-INFRASTRUCTURE §2, §12`, `docs/06 Faz 8`.

## Zaten mevcut (dokunma)

- `helmet` + global `ValidationPipe` (whitelist+transform) + CORS whitelist — `main.ts`
- `HttpExceptionFilter` — tam envelope (`success/message/errors?/statusCode/path/timestamp`)
- `trust proxy 1` + `enableShutdownHooks` — `main.ts`
- Health modülü (`PrismaHealthIndicator` + `RedisHealthIndicator`) + Swagger setup
- Throttler: global `300/dk/IP` (`ThrottlerModule.forRoot`) + per-route `@Throttle` (auth 30/dk, write 120/dk)
- `RedisService` (`@Global RedisModule`, `client: Redis` ioredis, prefix `tpulse:`)

## Kapsam (bu build)

### 1) Idempotency interceptor

`docs/04 §2`: yazma uçlarında `Idempotency-Key` header'ı opsiyonel; varsa Redis `SET NX` ile tekrar koruması.

- **Yeni:** `src/common/interceptors/idempotency.interceptor.ts` — `APP_INTERCEPTOR` (global).
- **Tetik koşulu:** Yalnız mutating method'larda (`POST/PUT/PATCH/DELETE`) **ve** `Idempotency-Key` header'ı varsa. Header yoksa → no-op (geç).
- **Key:** `idem:{userId}:{method}:{path}:{key}` — `userId = request.user?.sub ?? 'anon'`. (RedisService zaten `tpulse:` ekler.)
- **Davranış (.NET parite — SET NX, response cache YOK):**
  - `client.set(key, '1', 'EX', ttl, 'NX')` → `'OK'` dönerse kilit alındı → `next.handle()`.
  - `null` dönerse (TTL içinde tekrar) → `ConflictException` (409) `{ success:false, message:'Bu istek zaten alındı (idempotency)' }`.
- **TTL:** `IDEMPOTENCY_TTL_SECONDS` env (default `600` = 10dk).
- **Validation:** header trim; boşsa no-op; `maxLength 255` aşarsa `BadRequestException`.
- **Sıra notu:** Nest interceptor'ı guard'lardan sonra çalışır → `request.user` hazır olur. `docs/04` middleware sırası (Exception→Idempotency→…→Auth) kavramsal; Nest'te idempotency'nin auth sonrası çalışması `userId` için gereklidir, kabul edilebilir.
- **Hata izolasyonu:** Redis hatası (set throw) → interceptor **fail-open** (logla, isteği geçir) — idempotency altyapısı çökse bile yazma uçları çalışsın.

### 2) İsimlendirilmiş rate-limit policy'leri

`docs/02`: `auth` / `write` / `global` policy'leri. Şu an inline literal (`@Throttle({ default: { limit, ttl }})`) dağınık.

- **Yeni:** `src/common/throttle/throttle-policies.ts`:
  ```ts
  export const ThrottlePolicies = {
    auth:   { default: { limit: 30,  ttl: 60_000 } },  // login/register
    write:  { default: { limit: 120, ttl: 60_000 } },  // mutating controller'lar
  } as const;
  export const GLOBAL_THROTTLE = { ttl: 60_000, limit: 300 }; // ThrottlerModule.forRoot
  ```
- **Refactor:** Tüm controller'lardaki inline `@Throttle({...})` → `@Throttle(ThrottlePolicies.auth | .write)`. `ThrottlerModule.forRoot([GLOBAL_THROTTLE])`. **Davranış birebir aynı** (sadece DRY + isimlendirme).
- **Not:** Multi-pod için Redis storage gerekir; proje **tek process** olduğu için in-memory throttler korunur (kapsam dışı, spec'te belirt).

### 3) Route-parite testi + rapor

`docs/00 §7`: tüm uçlar eski backend ile aynı route+method.

- **Yeni:** `test/route-parity.spec.ts` — **app boot YOK / DB YOK**. Tüm controller class'larını import edip `@nestjs/common` reflection ile route topla:
  - `Reflect.getMetadata(PATH_METADATA, Controller)` → base path
  - Her method için `PATH_METADATA` + `METHOD_METADATA` (RequestMethod) → `{ method, path }`
  - Normalize: `/api/...` tam yol.
- **Yeni:** `test/fixtures/expected-endpoints.ts` — `docs/02`'den türetilmiş kanonik `{ method, path }[]` listesi (~120 uç).
- **Assert:** `expected ⊆ registered` (eksik uç = fail). `registered \ expected` (fazlalık) → uyarı listesi (fail değil, raporlanır).
- **Yeni:** `.factory/docs/parity-report.md` — `§7` checklist'i işaretli + uç kapsama özeti (toplam/eşleşen/eksik/fazla). Bot-kritik uçlar (`POST /api/rumours`, `POST /api/admin/transfers`, `GET /api/search`, `GET /api/players/search`, `POST /api/auth/login`) explicit kontrol satırı.

## Modeller / şema

Değişiklik yok (migration gerekmez).

## Paketler

Yeni paket **yok** (ioredis mevcut, OTel ertelendi, parite testi sadece reflection + jest).

## Env variables

- `IDEMPOTENCY_TTL_SECONDS` — default `600` (opsiyonel). `.env.example` + `env.validation.ts` (`z.coerce.number().int().default(600)`) + `configuration.ts` (`idempotency.ttlSeconds`).

## Test

- **Unit:** `idempotency.interceptor.spec.ts` — (a) header yoksa geç, (b) GET'te geç, (c) ilk key → SET NX 'OK' → handle çağrılır, (d) tekrar key → null → 409, (e) Redis throw → fail-open geç, (f) maxLength aşımı → 400.
- **Unit:** `route-parity.spec.ts` — expected uçların tamamı registered.
- **Regresyon:** mevcut 94 test yeşil kalmalı (throttle refactor kırmamalı).
- **Live e2e (/build):** ephemeral Docker (pg+redis) — aynı `Idempotency-Key` ile iki POST → ilki 201/202, ikincisi 409; farklı key → ikisi de geçer; header'sız → her ikisi de işlenir.

## Build sırası

1. `throttle-policies.ts` + controller refactor (davranış değişmez)
2. `idempotency.interceptor.ts` + `APP_INTERCEPTOR` kaydı (app.module)
3. env (`IDEMPOTENCY_TTL_SECONDS`) — validation + configuration + .env.example
4. `expected-endpoints.ts` fixture + `route-parity.spec.ts`
5. `parity-report.md`
6. Testler (unit + parite) → tsc + lint → live e2e (idempotency 409) → commit

## Kapsam dışı (sonraki)

- **Faz 8b:** OpenTelemetry (`@opentelemetry/sdk-node` + auto-instrumentations, trace+metrics, OTLP; endpoint yoksa no-op).
- İki-process (API + worker) ayrımı — tek process kararı gereği ertelenmiş.
