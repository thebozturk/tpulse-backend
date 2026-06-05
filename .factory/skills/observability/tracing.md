---
name: observability-tracing
keywords: "tracing, opentelemetry, jaeger, span, trace, distributed"
description: "Distributed tracing — OpenTelemetry"
---

# Distributed Tracing

## Why

Microservice'te bir request 5 service'i geziyor. "Hangisi yavaştı?" → trace.

## OpenTelemetry

```bash
pnpm add @opentelemetry/api @opentelemetry/sdk-node \
  @opentelemetry/auto-instrumentations-node \
  @opentelemetry/exporter-trace-otlp-http
```

```typescript
// tracing.ts (app boot'tan önce)
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'acme-backend',
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.APP_VERSION,
  }),
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
```

`auto-instrumentations` HTTP, MongoDB, Redis, axios otomatik trace'ler.

## Manual span

```typescript
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('user-service');

async function createUser(dto) {
  return tracer.startActiveSpan('createUser', async (span) => {
    try {
      span.setAttribute('user.email', dto.email);

      const hash = await tracer.startActiveSpan('hash-password', async (s) => {
        const h = await argon2.hash(dto.password);
        s.end();
        return h;
      });

      const user = await tracer.startActiveSpan('save-user', async (s) => {
        const u = await this.userModel.create({ ...dto, password: hash });
        s.end();
        return u;
      });

      span.end();
      return user;
    } catch (err) {
      span.recordException(err);
      span.setStatus({ code: 2 });  // ERROR
      span.end();
      throw err;
    }
  });
}
```

## Backend'ler

- **Jaeger** (open source)
- **Tempo** (Grafana)
- **Datadog APM**
- **Honeycomb**

OTLP standart — backend swap edilebilir.

## Trace context propagation

Service A → B çağrısı:
```typescript
// A
const headers = {};
api.inject(headers);  // OpenTelemetry trace context inject
await axios.post(url, data, { headers });

// B (auto-instrumented)
// HTTP middleware extract eder, span devam eder
```

Cross-service trace tek view'da.

## Sampling

Production'da %1 sample (her request trace pahalı):
```typescript
import { TraceIdRatioBasedSampler } from '@opentelemetry/sdk-trace-base';

const sdk = new NodeSDK({
  sampler: new TraceIdRatioBasedSampler(0.01),  // 1%
});
```

Hata durumunda 100% sample (custom logic).

## Aksiyon

1. OpenTelemetry SDK boot'tan önce kur
2. Auto-instrumentations
3. Critical path manual span
4. Sampling 1-10% (cost)
5. Backend: Jaeger/Tempo/Datadog
