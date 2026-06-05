---
name: resilience-bulkhead
keywords: "bulkhead, isolation, semaphore, pool, partition"
description: "Resource isolation — bir hata diğerini etkilemesin"
---

# Bulkhead

## Kavram

Gemi gövdesi su almasın diye **bulkhead** (su geçirmez bölme) ile böler. Bir bölme delinse diğerleri sağlam.

Yazılımda: bir component fail/slow olsa diğerlerini etkilemesin.

## Tipik uygulamalar

### 1. Connection pool partition

Database connection pool'u 100. Eğer tüm 100 connection bir slow endpoint için kullanılırsa diğer endpoint'ler beklemekte.

**Çözüm:** Critical operations için ayrı pool.

```typescript
// Default pool — read/write çoğu işlem
const mainPool = new MongoClient(uri, { maxPoolSize: 80 });

// Audit/log writes — yavaşlasa bile main işlemi etkilemez
const auditPool = new MongoClient(uri, { maxPoolSize: 20 });

@Injectable()
export class AuditService {
  constructor(@Inject(AUDIT_POOL) private readonly client: MongoClient) {}
}
```

### 2. Thread pool isolation (Node single-threaded — ama event loop)

Node single-threaded ama her external service için semaphore ile concurrency limit:

```typescript
import { Semaphore } from 'async-mutex';

const stripeSem = new Semaphore(10);   // max 10 concurrent Stripe call
const sendGridSem = new Semaphore(20); // max 20 SendGrid

async function chargeStripe(params) {
  const [, release] = await stripeSem.acquire();
  try {
    return await stripe.charges.create(params);
  } finally {
    release();
  }
}
```

Stripe yavaşladı → sadece Stripe call'ları queue oldu, SendGrid hala 20 free.

### 3. Per-tenant pool (multi-tenant)

Tenant A 10k req/min → Tenant B blocklanmasın.

```typescript
const tenantSemaphores = new Map<string, Semaphore>();

function getSem(tenantId: string): Semaphore {
  if (!tenantSemaphores.has(tenantId)) {
    tenantSemaphores.set(tenantId, new Semaphore(50));  // tenant başına 50 concurrent
  }
  return tenantSemaphores.get(tenantId)!;
}

async function tenantOperation(tenantId: string, fn: () => Promise<any>) {
  const sem = getSem(tenantId);
  const [, release] = await sem.acquire();
  try { return await fn(); } finally { release(); }
}
```

### 4. Critical vs non-critical

Critical (login, payment) ayrı pool/queue. Non-critical (analytics, audit) kendi başına.

```typescript
// Critical worker
@Processor('critical-queue', { concurrency: 50 })
class CriticalProcessor { ... }

// Background worker
@Processor('background-queue', { concurrency: 10 })
class BackgroundProcessor { ... }
```

Background queue dolu → critical etkilenmez.

## Implementation: async-mutex

```bash
pnpm add async-mutex
```

### Mutex (sadece 1 concurrent)
```typescript
import { Mutex } from 'async-mutex';

const mutex = new Mutex();

async function exclusiveOp() {
  await mutex.runExclusive(async () => {
    // Sadece 1 thread aynı anda
  });
}
```

### Semaphore (N concurrent)
```typescript
import { Semaphore } from 'async-mutex';

const sem = new Semaphore(5);  // max 5 concurrent

async function limitedOp() {
  await sem.runExclusive(async () => { ... });
}
```

## Bottleneck library

Daha gelişmiş rate limit + concurrency:

```bash
pnpm add bottleneck
```

```typescript
import Bottleneck from 'bottleneck';

const limiter = new Bottleneck({
  maxConcurrent: 10,        // 10 concurrent
  minTime: 100,              // her call arası 100ms
  highWater: 100,            // queue max 100 — fazlası reject
  strategy: Bottleneck.strategy.LEAK,
});

async function callExternal() {
  return limiter.schedule(() => axios.get('https://api.acme.com/...'));
}
```

External service'in rate limit'ine uymak için ideal.

## HTTP server worker pool

`worker_threads` CPU-intensive işler için:
```typescript
import { Worker } from 'worker_threads';

const pool = new WorkerPool('./image-processor.js', { size: 4 });

@Post('image')
async processImage(@UploadedFile() file: Express.Multer.File) {
  return pool.execute({ buffer: file.buffer });
  // CPU-intensive iş ayrı thread'de — main event loop boş kalır
}
```

CPU-bound olan tek bir endpoint tüm pod'u bloke etmez.

## Queue ile bulkhead

Bull/BullMQ ile:
```typescript
@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'emails' },
      { name: 'reports' },
      { name: 'webhooks' },
    ),
  ],
})

// Email queue down → reports etkilenmez
@Processor('emails', { concurrency: 5 })
class EmailProcessor { ... }

@Processor('reports', { concurrency: 2 })
class ReportProcessor { ... }
```

## Backpressure

Queue dolu = sistem overload. Reject yeni iş:
```typescript
const queueSize = await emailQueue.getWaitingCount();
if (queueSize > 10000) {
  throw new ServiceUnavailableException('Queue full, try later');
}
await emailQueue.add('send', emailData);
```

## Anti-pattern'ler

### Tek pool herşeye
```typescript
// ❌ DB connection 100, hepsini herkes kullanır
const pool = new MongoClient(uri, { maxPoolSize: 100 });
```

### Limitless concurrency
```typescript
await Promise.all(items.map(item => externalCall(item)));
// ❌ 10000 item → 10000 concurrent request → external rate limit + memory
```

p-limit veya semaphore:
```typescript
import pLimit from 'p-limit';
const limit = pLimit(10);
await Promise.all(items.map(item => limit(() => externalCall(item))));
```

### Queue concurrency yok
Queue boğuluyor → bekleyenler timeout. Concurrency tunelle.

### Semaphore release unutma
```typescript
const [, release] = await sem.acquire();
try { /* op */ }  // ❌ exception → release çağrılmaz
// finally release ZORUNLU
```

## Aksiyon

1. Critical vs non-critical separate pool/queue
2. External service için Semaphore
3. Per-tenant isolation (multi-tenant)
4. CPU-bound iş worker_threads
5. Queue concurrency tune
6. Backpressure: queue dolu → reject
7. p-limit / async-mutex / Bottleneck
