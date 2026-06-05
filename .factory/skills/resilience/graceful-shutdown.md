---
name: resilience-graceful-shutdown
keywords: "graceful, shutdown, SIGTERM, drain, kubernetes, lifecycle"
description: "SIGTERM handling, connection drain, zero-downtime"
---

# Graceful Shutdown

## Sorun

Kubernetes pod restart ediyor. SIGTERM gönderildi. Eğer:
- Yeni request kabul ediliyor → reject
- Aktif request bitmesini beklemiyor → 502'ler
- DB connection drop → write loss

## SIGTERM handler

```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  await app.listen(3000);

  let shuttingDown = false;
  ['SIGTERM', 'SIGINT'].forEach((signal) => {
    process.on(signal, async () => {
      if (shuttingDown) return;
      shuttingDown = true;

      logger.log(`${signal} received, starting graceful shutdown`);

      // 1. Health check 503 dönmeye başlasın (load balancer drain)
      healthIndicator.markShuttingDown();

      // 2. Yeni request kabul etme + aktifleri bekle
      await app.close();

      logger.log('Graceful shutdown complete');
      process.exit(0);
    });
  });
}
```

## NestJS lifecycle hooks

```typescript
@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  constructor(private readonly connection: Connection) {}

  async onApplicationShutdown(signal: string) {
    this.logger.log(`Closing DB connection (signal: ${signal})`);
    await this.connection.close();
  }
}

@Injectable()
export class RedisService implements OnApplicationShutdown {
  async onApplicationShutdown() {
    this.logger.log('Closing Redis');
    await this.client.quit();
  }
}

@Injectable()
export class JobService implements OnApplicationShutdown {
  async onApplicationShutdown() {
    this.logger.log('Stopping cron jobs');
    this.scheduler.stop();
    await this.runningJob?.waitForCompletion();
  }
}
```

## Drain time

Kubernetes default `terminationGracePeriodSeconds: 30`. SIGTERM → 30s → SIGKILL (zorla).

```yaml
# deployment.yaml
spec:
  terminationGracePeriodSeconds: 60  # extend gerekirse

  containers:
    - name: backend
      lifecycle:
        preStop:
          exec:
            command: ["sleep", "10"]  # SIGTERM öncesi load balancer drain
```

`preStop` → load balancer'ın endpoint'i listeden çıkarması için zaman.

## Health check shutdown awareness

```typescript
@Injectable()
export class HealthService {
  private shuttingDown = false;

  markShuttingDown() {
    this.shuttingDown = true;
  }

  async check(): Promise<HealthCheckResult> {
    if (this.shuttingDown) {
      throw new ServiceUnavailableException('Shutting down');
    }
    return { status: 'ok' };
  }
}
```

K8s readiness probe 503 alır → traffic kes.

## Kubernetes probes

```yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 3000
  periodSeconds: 30
  timeoutSeconds: 5
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /health/ready
    port: 3000
  periodSeconds: 10
  failureThreshold: 1  # bir fail → traffic kes (drain için)

startupProbe:
  httpGet:
    path: /health/live
    port: 3000
  failureThreshold: 30
  periodSeconds: 5
```

- **Liveness:** Pod alive mi (yoksa restart)
- **Readiness:** Traffic alabilir mi
- **Startup:** Slow boot için (init time)

## Background job cleanup

```typescript
@Injectable()
export class WorkerService implements OnApplicationShutdown {
  private currentJob?: Promise<void>;

  async start() {
    setInterval(async () => {
      this.currentJob = this.processJob();
      await this.currentJob;
      this.currentJob = undefined;
    }, 5000);
  }

  async onApplicationShutdown() {
    this.logger.log('Waiting for current job to finish');
    if (this.currentJob) {
      await Promise.race([
        this.currentJob,
        new Promise(r => setTimeout(r, 25_000)),  // max 25s wait
      ]);
    }
  }
}
```

## Queue worker (Bull/BullMQ)

```typescript
@Injectable()
export class QueueWorkerService implements OnApplicationShutdown {
  constructor(@InjectQueue('emails') private readonly queue: Queue) {}

  async onApplicationShutdown() {
    this.logger.log('Closing queue worker');
    await this.queue.close();  // mevcut job'lar biter, yeni almaz
  }
}
```

## DB transaction commit

Transaction sırasında SIGTERM → commit yarım kalmasın:
```typescript
async onApplicationShutdown() {
  // Aktif transaction'ların bitmesini bekle
  await Promise.race([
    this.activeTransactions.waitForAllToFinish(),
    new Promise(r => setTimeout(r, 20_000)),
  ]);

  await this.connection.close();
}
```

## Connection pool drain

```typescript
async onApplicationShutdown() {
  await this.connection.close();
  // Mongoose default'ta active queries bekler
}
```

## Sequence (sıra)

1. SIGTERM gelir
2. Health check `503` dönmeye başlar (preStop sleep ile load balancer drain)
3. Yeni HTTP request kabul edilmez (`server.close()`)
4. Aktif request'ler bitmesini bekler (max 25s)
5. Background job'lar durur, mevcut job biter
6. Queue worker drain
7. DB connection close (active query bekle)
8. Redis close
9. Process exit

## Anti-pattern'ler

### enableShutdownHooks() yok
```typescript
const app = await NestFactory.create(AppModule);
await app.listen(3000);
// ❌ OnApplicationShutdown çağrılmaz
```

### Sync close
```typescript
onApplicationShutdown() {
  fs.writeFileSync('shutdown.log', 'ok');  // ❌ block
}
```

### Long-running shutdown
```typescript
async onApplicationShutdown() {
  await migrate();  // ❌ 5 dakika — k8s SIGKILL atar
}
```

### No drain time
```yaml
terminationGracePeriodSeconds: 5  # ❌ active request kesilir
```

### Probe yok
Probe yoksa k8s pod'u "ready" sayar, in-flight request'ler kaybolur.

## Aksiyon

1. SIGTERM handler + app.close()
2. enableShutdownHooks
3. Health check shutdown awareness (503)
4. K8s preStop sleep + readinessProbe
5. terminationGracePeriodSeconds: 30-60s
6. Background job + queue drain
7. DB transaction wait (max 20s)
8. Sequenced cleanup (probe → http → jobs → connections)
