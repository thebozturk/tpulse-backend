---
name: resilience-health-checks
keywords: "health, liveness, readiness, startup, terminus, probe"
description: "Health check endpoint'leri — liveness, readiness, startup"
---

# Health Checks

## Üç probe tipi (Kubernetes)

### Liveness — "uygulama yaşıyor mu?"
Fail → pod restart.
Sadece app crash'i tespit. DB down olsa bile liveness OK (DB pod'u yeniden başlatmaz).

```typescript
@Get('health/live')
@Public()
@SkipThrottle()
async live() {
  return { status: 'ok', uptime: process.uptime() };
}
```

### Readiness — "traffic alabilir mi?"
Fail → pod listeden çıkar (traffic kes).
DB down → readiness fail → traffic kesilir, restart edilmez (DB döndüğünde pod hemen kullanılır).

```typescript
@Get('health/ready')
@Public()
@SkipThrottle()
async ready() {
  // DB ping
  await this.connection.db.admin().ping();
  // Redis ping
  await this.redis.ping();
  return { status: 'ready' };
}
```

### Startup — "boot tamam mı?"
Slow boot uygulamalar için. Migration, cache warm vs. bekler.
Geçince liveness'e dönüş.

```typescript
@Get('health/startup')
@Public()
async startup() {
  if (!this.app.bootCompleted) {
    throw new ServiceUnavailableException();
  }
  return { status: 'started' };
}
```

## @nestjs/terminus

```bash
pnpm add @nestjs/terminus
```

```typescript
@Module({
  imports: [TerminusModule, MongooseModule],
  controllers: [HealthController],
})
export class HealthModule {}

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly mongoose: MongooseHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly disk: DiskHealthIndicator,
  ) {}

  @Get('ready')
  @Public()
  @SkipThrottle()
  @HealthCheck()
  ready() {
    return this.health.check([
      () => this.mongoose.pingCheck('mongodb'),
      () => this.memory.checkHeap('heap', 250 * 1024 * 1024),       // < 250MB
      () => this.memory.checkRSS('rss', 500 * 1024 * 1024),         // < 500MB
      () => this.disk.checkStorage('disk', { path: '/', thresholdPercent: 0.9 }),
    ]);
  }

  @Get('live')
  @Public()
  @SkipThrottle()
  live() {
    return { status: 'ok', uptime: process.uptime() };
  }
}
```

Output:
```json
{
  "status": "ok",
  "info": {
    "mongodb": { "status": "up" },
    "heap": { "status": "up" },
    "rss": { "status": "up" }
  },
  "details": { ... }
}
```

## Custom health indicator

External service ping:
```typescript
@Injectable()
export class StripeHealthIndicator extends HealthIndicator {
  constructor(private readonly stripe: Stripe) { super(); }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.stripe.balance.retrieve();
      return this.getStatus(key, true);
    } catch (err) {
      throw new HealthCheckError('Stripe down', this.getStatus(key, false, { error: err.message }));
    }
  }
}

// Kullanım
() => this.stripeHealth.isHealthy('stripe'),
```

## Hangi check ready'ye, hangi live'a

### Liveness check
- Process responsive mi (HTTP request alıyor mu)
- Memory leak threshold geçti mi (heap > X)
- Deadlock yok mu

**KAÇIN:** External dependency check liveness'te. Mongo down → restart pod → tekrar fail → CrashLoop.

### Readiness check
- DB ping
- Cache (Redis) ping
- External critical service (Stripe, etc.)
- Disk space (write için)

DB down → readiness fail → traffic gitmez. DB back → readiness OK → traffic döner. Pod restart YOK.

## Health endpoint security

```typescript
@Get('health/ready')
@Public()              // Auth gerekmez (k8s ping)
@SkipThrottle()        // Rate limit dışı
async ready() { ... }
```

Detaylı bilgi sızdırma:
```typescript
// ❌ Production'da version expose
{ version: '1.2.3', dbVersion: '7.0.5', deps: { axios: '1.6.0' } }

// ✓ Minimal
{ status: 'ok' }
```

Internal health (detaylı) ayrı endpoint, internal-only:
```typescript
@Get('health/internal')
@Public()
@UseGuards(InternalNetworkGuard)  // sadece 10.0.0.0/8
async internal() { ... }
```

## Kubernetes deployment

```yaml
spec:
  containers:
    - name: backend
      livenessProbe:
        httpGet:
          path: /health/live
          port: 3000
        periodSeconds: 30
        timeoutSeconds: 5
        failureThreshold: 3
        # 3 fail × 30s = 90s sonra restart

      readinessProbe:
        httpGet:
          path: /health/ready
          port: 3000
        periodSeconds: 10
        timeoutSeconds: 5
        failureThreshold: 1
        # 1 fail → traffic drain hemen

      startupProbe:
        httpGet:
          path: /health/live
          port: 3000
        failureThreshold: 30
        periodSeconds: 5
        # 30 × 5s = 150s boot için izin
```

## Liveness logic

Sadece "app crashed" tespit. Memory leak veya unhandled promise için:
```typescript
let isAlive = true;

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', err);
  isAlive = false;
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', reason);
  isAlive = false;
});

@Get('health/live')
async live() {
  if (!isAlive) throw new ServiceUnavailableException();
  return { ok: true };
}
```

## Anti-pattern'ler

### Liveness'te DB check
```typescript
@Get('health/live')
async live() {
  await this.db.ping();  // ❌
  return ok;
}
```
DB down → tüm pod restart → cascading.

### Liveness uzun
```typescript
@Get('health/live')
async live() {
  await this.fullSystemCheck();  // ❌ 30s+
  // probe timeout → fail → restart
}
```

### Readiness probe yok
Yeni pod boot ederken traffic gelir → connection refused.

### Detaylı response production'da
```typescript
return { dbHost: '10.0.0.5', dbVersion: '7.0.5', secret: '...' };  // ❌
```

### Auth health'te
```typescript
@UseGuards(JwtAuthGuard)
@Get('health/live')  // ❌ k8s probe token sahip değil
```

## Aksiyon

1. /health/live, /health/ready, /health/startup
2. @nestjs/terminus indicators
3. Liveness MINIMAL (process responsive)
4. Readiness DB+Redis+critical external
5. K8s probe config (period, failure)
6. Public + SkipThrottle
7. Production response minimal
8. Custom indicator external service için
