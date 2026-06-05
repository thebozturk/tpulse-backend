---
name: nestjs-lifecycle
keywords: "lifecycle, OnModuleInit, OnApplicationShutdown, graceful shutdown, bootstrap"
description: "Module bootstrap, shutdown hooks, resource cleanup"
---

> **Stack-aware:** Bu skill MongoDB/Mongoose örnekleri veriyor. Prisma+PostgreSQL projelerinde aynı pattern paralel olarak `prisma/` ve `postgres/` skill'lerinde anlatılır. Önce `.factory/memory/conventions.json` → `stack.orm` field'ına bak.


# Lifecycle Hooks

## Hook sırası

```
1. onModuleInit          — modül yüklendi, tüm provider'lar DI edildi
2. onApplicationBootstrap — tüm modüller hazır, uygulama ayakta
--- uygulama çalışıyor ---
3. onModuleDestroy        — modül kapatılıyor (shutdown signal geldi)
4. beforeApplicationShutdown(signal) — shutdown başladı
5. onApplicationShutdown(signal)     — son temizlik
```

## OnModuleInit — hazır olduğunda init

```typescript
@Injectable()
export class CacheService implements OnModuleInit {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onModuleInit() {
    await this.redis.ping();  // connection warmup
    this.logger.log('Cache ready');
  }
}
```

Kullanım: warmup, index kontrolü, external service connection.

## OnApplicationShutdown — graceful shutdown

```typescript
@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  constructor(private readonly connection: Connection) {}

  async onApplicationShutdown(signal: string) {
    this.logger.log(`Shutdown signal: ${signal}. Closing DB...`);
    await this.connection.close();
  }
}
```

## Graceful shutdown setup

`main.ts`'te:
```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Lifecycle hook'larını aktive et
  app.enableShutdownHooks();

  await app.listen(3000);
}
```

Bunsuz `onApplicationShutdown` çağrılmaz.

## SIGTERM handling

Kubernetes, Docker `SIGTERM` gönderir. Handle etmezse connection drop, unfinished request'ler kaybolur.

```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  // Shutdown'ı bekleme süresi (grace period)
  // Load balancer'ın drain etmesi için
  const SHUTDOWN_TIMEOUT = 30_000;

  process.on('SIGTERM', async () => {
    logger.log('SIGTERM received');

    // 1. Yeni request kabul etme
    await app.close();

    // 2. Mevcut request'lerin bitmesini bekle
    // (app.close zaten bunu yapar)

    process.exit(0);
  });

  await app.listen(3000);
}
```

## Health check

Shutdown sırasında healthcheck `503` dönmeli ki load balancer traffic kessin:

```typescript
@Injectable()
export class HealthIndicator implements OnModuleInit, OnApplicationShutdown {
  private shuttingDown = false;

  onApplicationShutdown() {
    this.shuttingDown = true;
  }

  isHealthy(): boolean {
    return !this.shuttingDown;
  }
}

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthIndicator) {}

  @Get()
  @Public()
  @SkipThrottle()
  check() {
    if (!this.health.isHealthy()) {
      throw new ServiceUnavailableException();
    }
    return { status: 'ok' };
  }
}
```

## Background job cleanup

Cron, queue worker, polling task:

```typescript
@Injectable()
export class NotificationSender implements OnModuleInit, OnApplicationShutdown {
  private intervalId?: NodeJS.Timeout;

  onModuleInit() {
    this.intervalId = setInterval(() => this.tick(), 5000);
  }

  onApplicationShutdown() {
    if (this.intervalId) clearInterval(this.intervalId);
    // Running tick'in bitmesini bekle
    return this.waitForCurrentTick();
  }
}
```

## Resource pool

DB connection pool drain:

```typescript
async onApplicationShutdown() {
  this.logger.log('Draining DB pool...');
  await this.connection.close();  // mongoose, waits for active queries

  this.logger.log('Draining Redis...');
  await this.redis.quit();  // waits for pending commands
}
```

## Order of shutdown

Hook'lar parallel çalışır — birine bağlı bir şey varsa dikkat.

Genel sıra:
1. Yeni request kabul etme (app.close)
2. Inflight request'ler bitsin (drain, 30s timeout)
3. Background job'ları durdur (cron, queue)
4. External connection'ları kapat (Redis, MongoDB son)

## Anti-pattern'ler

### Hook'ta async olmadan I/O
```typescript
// KÖTÜ — sync I/O shutdown'ı bozuyor
onApplicationShutdown() {
  fs.writeFileSync('shutdown.log', 'ok');  // sync
}
```

### Uzun süren hook
```typescript
// KÖTÜ
async onApplicationShutdown() {
  await migrate();  // 5 dakikalık işlem — k8s sabırsız, SIGKILL atar
}
```
Shutdown hook'u 30s'den uzun sürmemeli.

### enableShutdownHooks() atlama
```typescript
// KÖTÜ
const app = await NestFactory.create(AppModule);
await app.listen(3000);
// Hook'lar çağrılmaz → DB connection leak
```

## Aksiyon

1. main.ts'te `app.enableShutdownHooks()`
2. DB, Redis, external connection service'leri `OnApplicationShutdown`
3. Health check shutdown sırasında 503 dönsün
4. Background job'lar kendilerini temiz durdursun
5. Grace period: 30s (k8s terminationGracePeriodSeconds=30)
6. SIGTERM → drain → close
