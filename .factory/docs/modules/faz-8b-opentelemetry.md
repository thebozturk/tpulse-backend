# faz-8b-opentelemetry

## Amaç

`docs/04 §8` + `docs/00/05`: OpenTelemetry ile **trace + metrics**, service adı `TransferPulse.Api`, **OTLP/HTTP** exporter, **auto-instrumentations**. Faz 8'den ertelenen observability kalemi.

**Kritik kural:** `OTEL_EXPORTER_OTLP_ENDPOINT` set değilse → **tam no-op** (SDK hiç başlamaz, lokalde sıfır maliyet). Prodda env ile açılır.

## Kararlar (kullanıcı onaylı)

- Exporter: **OTLP/HTTP** (4318) — `exporter-trace-otlp-http` + `exporter-metrics-otlp-http`
- Instrumentation: **tam** `getNodeAutoInstrumentations()` — `fs` kapalı (gürültü)
- Init: `main.ts` en üst satırında `import './tracing';` (side-effect, ES import hoisting ile diğer importlardan önce çalışır)

## Neden import-first (ConfigService değil)

Instrumentation'lar `http`/`express`/`pg`/`ioredis` modüllerini **require anında** monkey-patch'ler. Nest açılmadan önce SDK başlamazsa bu modüller patch'siz yüklenir → span üretilmez. Bu yüzden `tracing.ts`:
- `process.env`'i **doğrudan** okur (validateEnv/ConfigService'e bağlı değil — onlar Nest lifecycle'ında).
- Side-effect olarak import anında çalışır.

## Dosya yapısı

```
src/
├── tracing.ts          # YENİ — NodeSDK init (no-op gating + helpers export)
├── tracing.spec.ts     # YENİ — gating helper unit testleri
└── main.ts             # DEĞİŞ — 1. satır: import './tracing';
```

## tracing.ts tasarımı

```ts
// İLK import — hiçbir uygulama modülünden önce
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';

const DEFAULT_SERVICE_NAME = 'TransferPulse.Api';

// Test edilebilir saf yardımcılar
export function telemetryEnabled(env: NodeJS.ProcessEnv): boolean {
  return !!env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
}
export function resolveServiceName(env: NodeJS.ProcessEnv): string {
  return env.OTEL_SERVICE_NAME?.trim() || DEFAULT_SERVICE_NAME;
}

export function startTelemetry(env: NodeJS.ProcessEnv = process.env): NodeSDK | null {
  if (!telemetryEnabled(env)) return null; // no-op

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: resolveServiceName(env),
      [ATTR_SERVICE_VERSION]: env.npm_package_version ?? '0.0.1',
    }),
    // Exporter'lar OTEL_EXPORTER_OTLP_ENDPOINT / _HEADERS env'lerini otomatik okur.
    traceExporter: new OTLPTraceExporter(),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter(),
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });
  sdk.start();
  const shutdown = () => void sdk.shutdown().finally(() => process.exit(0));
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
  return sdk;
}

// Side-effect: import-first garantisi
startTelemetry();
```

> Not: `resourceFromAttributes` + `ATTR_SERVICE_NAME` API'si kurulan `@opentelemetry/resources`/`semantic-conventions` sürümüne göre adapte edilecek (eski sürümde `new Resource({...})` + `SemanticResourceAttributes.SERVICE_NAME`). /build'de install sonrası doğrulanır.

## main.ts değişikliği

```ts
import './tracing'; // ← MUTLAKA 1. satır (diğer tüm importlardan önce)
import { ValidationPipe } from '@nestjs/common';
// ... mevcut importlar
```

## Paketler (yeni)

- `@opentelemetry/sdk-node`
- `@opentelemetry/auto-instrumentations-node`
- `@opentelemetry/exporter-trace-otlp-http`
- `@opentelemetry/exporter-metrics-otlp-http`
- `@opentelemetry/sdk-metrics`
- `@opentelemetry/resources`
- `@opentelemetry/semantic-conventions`

(Hepsi runtime dep. `@opentelemetry/api` peer olarak gelir.)

## Env variables (standart OTel — `.env.example`'a)

```env
# OpenTelemetry (endpoint BOŞ ise telemetry tamamen kapalı — no-op)
OTEL_EXPORTER_OTLP_ENDPOINT=          # örn. http://localhost:4318
OTEL_SERVICE_NAME=TransferPulse.Api
# OTEL_EXPORTER_OTLP_HEADERS=          # örn. authorization=Bearer xxx (opsiyonel)
```

> Bunlar `tracing.ts` tarafından `process.env`'den okunur — **zod env.validation'a EKLENMEZ** (Nest lifecycle dışı). zod `safeParse` bilinmeyen env'leri zaten yok sayar, boot'u kırmaz.

## Kurallar

- Endpoint yoksa SDK başlamaz, hiçbir paket connection açmaz (no-op).
- `tracing.ts` uygulama kodu import etmez (sadece otel paketleri + process.env).
- SIGTERM/SIGINT'te `sdk.shutdown()` (graceful flush) — mevcut `enableShutdownHooks` ile çakışmaz (otel kendi handler'ı).
- Hardcoded endpoint/secret YOK (env).

## Test

- **Unit (`tracing.spec.ts`):**
  - `telemetryEnabled({})` → false; `telemetryEnabled({OTEL_EXPORTER_OTLP_ENDPOINT:'http://x:4318'})` → true; boş string → false.
  - `resolveServiceName({})` → `'TransferPulse.Api'`; `resolveServiceName({OTEL_SERVICE_NAME:'X'})` → `'X'`.
  - `startTelemetry({})` → `null` (no-op).
  - (SDK'nın gerçek start'ı unit'te denenmez — import side-effect test env'de endpoint yok → no-op, güvenli.)
- **Regresyon:** mevcut 105 test yeşil (main.ts import-first kırmamalı).
- **Live e2e (/build):**
  1. `otel/opentelemetry-collector` (debug/logging exporter) ephemeral container.
  2. App'i `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318` ile boot → `/health` + bir route çağır → collector log'unda HTTP server span'i (`service.name=TransferPulse.Api`) görünür.
  3. Endpoint'siz boot → telemetry log yok, app normal çalışır (no-op doğrulaması).

## Build sırası

1. Paket install (pnpm add — 7 otel paketi)
2. `tracing.ts` (kurulu sürüme göre Resource API adapte)
3. `main.ts` 1. satır import
4. `.env.example` OTEL_* değişkenleri
5. `tracing.spec.ts`
6. tsc + lint + test (105+ regresyon) → live e2e (collector ile span doğrulama) → commit

## Kapsam dışı

- Custom business span/metric (sadece auto-instrumentation — docs generic "trace+metrics").
- Prometheus scrape endpoint (OTLP push yeterli).
- Log korelasyonu (trace_id log injection) — ileride opsiyonel.
