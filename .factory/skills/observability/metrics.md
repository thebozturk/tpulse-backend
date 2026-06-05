---
name: observability-metrics
keywords: "metrics, prometheus, prom-client, RED, USE, monitoring"
description: "Prometheus metrics — RED metrics, custom metrics"
---

# Metrics

## Prometheus + prom-client

```bash
pnpm add prom-client @willsoto/nestjs-prometheus
```

```typescript
// app.module.ts
import { PrometheusModule } from '@willsoto/nestjs-prometheus';

@Module({
  imports: [
    PrometheusModule.register({
      defaultMetrics: { enabled: true },  // Node.js metric (memory, CPU, GC)
      path: '/metrics',
    }),
  ],
})
```

`GET /metrics` Prometheus formatında metric döner.

## RED method

3 metric her endpoint için:
- **R**ate — req/sec
- **E**rrors — error rate
- **D**uration — latency p50/p95/p99

```typescript
import { Counter, Histogram } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly httpRequests = new Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'route', 'status'],
  });

  private readonly httpDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
  });

  recordHttp(method: string, route: string, status: number, durationMs: number) {
    this.httpRequests.inc({ method, route, status });
    this.httpDuration.observe({ method, route, status }, durationMs / 1000);
  }
}
```

Interceptor ile her request'te:
```typescript
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const req = ctx.switchToHttp().getRequest();
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const res = ctx.switchToHttp().getResponse();
        this.metrics.recordHttp(req.method, req.route?.path, res.statusCode, Date.now() - start);
      }),
      catchError((err) => {
        const status = err.status || 500;
        this.metrics.recordHttp(req.method, req.route?.path, status, Date.now() - start);
        return throwError(() => err);
      }),
    );
  }
}
```

## Business metrics

```typescript
const usersRegistered = new Counter({
  name: 'users_registered_total',
  help: 'Total user registrations',
  labelNames: ['source'],
});

usersRegistered.inc({ source: 'organic' });

const ordersCreated = new Counter({ name: 'orders_created_total' });
const orderRevenue = new Histogram({
  name: 'order_revenue',
  buckets: [10, 50, 100, 500, 1000, 5000],
});

orderRevenue.observe(order.amount);
```

## Cardinality kontrolü

Label sayısı patlar → Prometheus disk patlar.

❌ Yüksek cardinality:
```typescript
labelNames: ['user_id']  // 1M user → 1M time series
```

✓ Bounded:
```typescript
labelNames: ['user_tier']  // 'free', 'pro', 'enterprise' — 3 değer
```

User-specific metric ayrı bir tool (Honeycomb, OpenTelemetry).

## Hangi metric'ler

### Sistem
- `process_resident_memory_bytes`
- `nodejs_eventloop_lag_seconds`
- `nodejs_heap_size_total_bytes`

### HTTP (RED)
- `http_requests_total`
- `http_request_duration_seconds`

### Database
- `mongodb_query_duration_seconds`
- `mongodb_connections_active`
- `mongodb_query_errors_total`

### Business
- `users_registered_total`
- `orders_created_total`
- `revenue_dollars_total`

## Anti-pattern'ler

### Yüksek cardinality
- userId, orderId label'da

### Counter reset
- `inc()` yerine `set(0)` — counter'lar monoton artmalı

### Metric çok yüksek frequency
- Her log line counter yerine, batch updates

## Aksiyon

1. /metrics endpoint
2. RED metrics (rate, error, duration)
3. Business metric'ler
4. Cardinality kontrol
5. Default Node metric'ler (memory, GC, event loop)
