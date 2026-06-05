---
name: streaming-event-bus
keywords: "redis, pub/sub, event bus, multi-instance"
description: "Redis pub/sub — multi-instance event broadcasting"
---

# Event Bus (Redis Pub/Sub)

Multi-instance NestJS app + SSE/WebSocket → events her instance'a broadcast.

## Problem

```
Instance A: User X bağlı (SSE)
Instance B: Order servisi event emit ediyor
→ Event Subject A'ya değil B'ye giriyor
→ User X görmüyor
```

## Çözüm: Redis pub/sub bridge

```
Instance B: emit → Redis publish → Redis subscribers
Instance A: subscribe → relay to local Subject → User X
```

## Implementation

### Service
```typescript
// src/events/event-bus.service.ts
import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from "@nestjs/common";
import { Subject, Observable, filter } from "rxjs";
import { Redis } from "ioredis";

interface DomainEvent {
  type: string;
  userId?: string;
  orgId?: string;
  data: unknown;
  timestamp: number;
}

@Injectable()
export class EventBusService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventBusService.name);
  private publisher!: Redis;
  private subscriber!: Redis;
  private local$ = new Subject<DomainEvent>();
  private readonly CHANNEL = "app:events";

  async onModuleInit() {
    this.publisher = new Redis(process.env.REDIS_URL!);
    this.subscriber = new Redis(process.env.REDIS_URL!);

    await this.subscriber.subscribe(this.CHANNEL);
    this.subscriber.on("message", (channel, message) => {
      if (channel !== this.CHANNEL) return;
      try {
        const event = JSON.parse(message) as DomainEvent;
        this.local$.next(event);
      } catch (err) {
        this.logger.error("Failed to parse event", err);
      }
    });

    this.logger.log("Event bus ready");
  }

  async onModuleDestroy() {
    await this.publisher.quit();
    await this.subscriber.quit();
  }

  /** Publish event — broadcast to ALL instances */
  async emit(event: Omit<DomainEvent, "timestamp">) {
    const full: DomainEvent = { ...event, timestamp: Date.now() };
    await this.publisher.publish(this.CHANNEL, JSON.stringify(full));
  }

  /** Subscribe — receive events from any instance */
  subscribe(): Observable<DomainEvent> {
    return this.local$.asObservable();
  }

  /** Filter by user */
  forUser(userId: string): Observable<DomainEvent> {
    return this.subscribe().pipe(filter(e => e.userId === userId));
  }

  /** Filter by type */
  forType(type: string): Observable<DomainEvent> {
    return this.subscribe().pipe(filter(e => e.type === type));
  }
}
```

### Module (global)

```typescript
@Global()
@Module({
  providers: [EventBusService],
  exports: [EventBusService],
})
export class EventBusModule {}
```

## SSE controller integration

```typescript
@Sse("stream")
@UseGuards(JwtAuthGuard)
stream(@CurrentUser() user: User): Observable<MessageEvent> {
  return this.eventBus.forUser(user.id).pipe(
    map(e => ({
      type: e.type,
      data: e.data,
      id: String(e.timestamp),
    })),
  );
}
```

User Instance A'da bağlı → Instance B'de Redis'e publish → Instance A'da subscribe → User'a SSE.

## Service emit

```typescript
@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
  ) {}

  async create(userId: string, dto: CreateOrderDto) {
    const order = await this.prisma.order.create({ data: { userId, ...dto } });

    await this.eventBus.emit({
      type: "order.created",
      userId,
      data: { orderId: order.id, total: order.total },
    });

    return order;
  }
}
```

## Channel partitioning (high-volume)

Single channel bottleneck olursa:

```typescript
const CHANNEL = `app:events:user:${userId}`;
await this.publisher.publish(CHANNEL, JSON.stringify(event));

// Subscriber pattern
await this.subscriber.psubscribe(`app:events:user:*`);
this.subscriber.on("pmessage", (pattern, channel, message) => {
  // ...
});
```

## Persistent vs ephemeral

Redis pub/sub **ephemeral** — subscriber yoksa event kaybolur.

Persistent gerekirse:
- **Redis Streams** — durable, ordered, replay
- **Postgres LISTEN/NOTIFY** — DB-level
- **RabbitMQ / Kafka** — heavyweight

### Redis Streams (durable)
```typescript
// Producer
await redis.xadd("events", "*", "type", "order.created", "data", JSON.stringify(data));

// Consumer
const events = await redis.xread("BLOCK", 0, "STREAMS", "events", "$");
```

`$` = block until new event. Last ID kaydet, restart'ta resume.

### Consumer groups (multiple workers)
```typescript
await redis.xgroup("CREATE", "events", "workers", "$", "MKSTREAM");
const events = await redis.xreadgroup(
  "GROUP", "workers", "worker-1",
  "COUNT", 10, "BLOCK", 1000,
  "STREAMS", "events", ">",
);
// Each event delivered to ONE consumer in group
await redis.xack("events", "workers", id);   // mark processed
```

## Postgres LISTEN/NOTIFY (DB-level event)

```typescript
// Producer (any service)
await prisma.$executeRaw`SELECT pg_notify('app_events', ${JSON.stringify(event)})`;

// Or trigger-based
CREATE FUNCTION notify_user_created() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('user_events', json_build_object('action', 'created', 'id', NEW.id)::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_user_insert AFTER INSERT ON users
FOR EACH ROW EXECUTE FUNCTION notify_user_created();
```

```typescript
// NestJS subscriber
import { Client } from "pg";

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
await client.query("LISTEN app_events");
client.on("notification", (msg) => {
  const event = JSON.parse(msg.payload!);
  this.local$.next(event);
});
```

⚠️ Postgres LISTEN/NOTIFY 8KB payload limit — large event'ler için ID send + DB lookup.

## Pattern decision

| Need | Choice |
|------|--------|
| Multi-instance NestJS event bridge | Redis pub/sub |
| Durable, replay needed | Redis Streams |
| Multi-worker fan-out | Redis Streams + consumer groups |
| DB-level event (trigger) | Postgres LISTEN/NOTIFY |
| High-throughput, microservice | Kafka / RabbitMQ |
| Simple, single instance | In-memory Subject |

## Anti-pattern'ler

### Single Redis client for pub + sub
Subscriber connection blocked from sending → use 2 clients.

### Forgetting JSON serialize
Redis stores text. `redis.publish("ch", { foo: "bar" })` → "[object Object]" kaybolur.

### Pub/sub for critical events
Subscriber down → event lost. Use Redis Streams or queue (BullMQ).

### Massive event payload
8KB+ JSON each event → bandwidth + parse cost. Send ID, fetch from DB.

### Event without user/org context
```typescript
emit({ type: "post.published", data: { postId } });
// All instances broadcast to all users
```

→ Filter early: include `userId` / `orgId`.

## Aksiyon

1. Redis pub/sub multi-instance event bridge
2. Two Redis clients (pub + sub)
3. EventBusService subject pattern + filter helpers
4. Single channel default, partition high-volume
5. Durable need → Redis Streams (consumer groups)
6. DB-level triggers → Postgres LISTEN/NOTIFY
7. Critical events → BullMQ queue, mass broadcast → pub/sub
