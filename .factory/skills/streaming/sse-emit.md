---
name: streaming-sse-emit
keywords: "SSE, server-sent events, EventSource, stream"
description: "NestJS SSE — controller pattern, RxJS Observable"
---

# SSE (Backend Emit)

Server-Sent Events — HTTP keep-alive üzerinden text stream.

## Format (raw HTTP)

```
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

event: message
data: {"foo":"bar"}
id: 42

event: progress
data: {"percent":50}

```

Multi-line: 2 newline = end of event.

## NestJS @Sse decorator

```typescript
import { Controller, Sse, MessageEvent, Param } from "@nestjs/common";
import { Observable, interval, map } from "rxjs";

@Controller("events")
export class EventsController {
  @Sse("notifications")
  notifications(): Observable<MessageEvent> {
    return interval(1000).pipe(
      map(n => ({
        type: "notification",
        data: { count: n, ts: new Date().toISOString() },
      })),
    );
  }
}
```

GET `/events/notifications` → SSE stream.

`MessageEvent` shape:
```typescript
interface MessageEvent {
  data: any;          // serialized as JSON
  id?: string;        // event ID (auto-resume)
  type?: string;      // event name
  retry?: number;     // reconnect delay (ms)
}
```

## Real-world — service event bridge

```typescript
import { Injectable } from "@nestjs/common";
import { Subject, Observable } from "rxjs";
import { filter, map } from "rxjs/operators";

interface Event {
  userId: string;
  type: string;
  data: any;
}

@Injectable()
export class EventStreamService {
  private events$ = new Subject<Event>();

  emit(event: Event) {
    this.events$.next(event);
  }

  forUser(userId: string): Observable<MessageEvent> {
    return this.events$.pipe(
      filter(e => e.userId === userId),
      map(e => ({
        type: e.type,
        data: e.data,
        id: crypto.randomUUID(),
      })),
    );
  }
}
```

```typescript
@Controller("stream")
@UseGuards(JwtAuthGuard)
export class StreamController {
  constructor(private events: EventStreamService) {}

  @Sse()
  stream(@CurrentUser() user: User): Observable<MessageEvent> {
    return this.events.forUser(user.id);
  }
}
```

Diğer servisler:
```typescript
@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private events: EventStreamService,
  ) {}

  async create(userId: string, dto: CreateOrderDto) {
    const order = await this.prisma.order.create({ data: { userId, ...dto } });

    this.events.emit({
      userId,
      type: "order.created",
      data: { orderId: order.id, total: order.total },
    });

    return order;
  }
}
```

## Heartbeat / keep-alive

Proxy/load balancer 30s+ idle connection drop edebilir. Heartbeat gönder:

```typescript
import { merge, interval, of } from "rxjs";

@Sse("stream")
stream(): Observable<MessageEvent> {
  const events$ = this.events.forUser(userId);
  const heartbeat$ = interval(15000).pipe(
    map(() => ({ type: "heartbeat", data: { ts: Date.now() } })),
  );
  return merge(events$, heartbeat$);
}
```

15s'lik heartbeat — proxy timeout 60s'i aşmadan reset.

## Last-Event-ID resume

Browser reconnect'te `Last-Event-ID` header gönderir. Server hangi event'ten devam edileceğini bilir:

```typescript
@Sse("stream")
stream(@Headers("last-event-id") lastId?: string): Observable<MessageEvent> {
  // lastId varsa o event'ten sonra gelenleri gönder
  // Implementation: events Redis/DB'de persist + ID-based query
}
```

In-memory için event ID = monotonic counter veya timestamp + sequence.

## Authentication

SSE EventSource header destekler değil (browser API limit). Alternatif:

### 1. Cookie-based (recommended)
```typescript
@Sse("stream")
@UseGuards(JwtCookieGuard)   // reads cookie, not header
stream() { /* ... */ }
```

Frontend:
```typescript
const eventSource = new EventSource("/stream", { withCredentials: true });
```

### 2. Token in URL (less secure — appears in logs)
```typescript
@Sse("stream/:token")
stream(@Param("token") token: string) {
  const user = this.jwt.verify(token);
  // ...
}
```

URL'de token → server log, browser history. Sadece short-lived ephemeral token ile.

### 3. EventSource polyfill (custom headers support)
```bash
pnpm add eventsource
```

Frontend:
```typescript
import EventSource from "eventsource";
const es = new EventSource("/stream", {
  headers: { Authorization: `Bearer ${token}` },
});
```

## Backpressure

SSE'de native backpressure YOK — slow client memory dolar.

### Buffer + drop
```typescript
import { bufferTime, mergeMap, throttleTime } from "rxjs/operators";

events$.pipe(
  // High-frequency event'leri 1s'de batch
  bufferTime(1000),
  filter(batch => batch.length > 0),
  map(batch => ({ type: "batch", data: batch })),
);
```

### Connection limit per user
```typescript
@Injectable()
export class ConnectionLimit {
  private connections = new Map<string, number>();

  acquire(userId: string): boolean {
    const count = this.connections.get(userId) ?? 0;
    if (count >= 5) return false;       // max 5 concurrent
    this.connections.set(userId, count + 1);
    return true;
  }

  release(userId: string) {
    const count = this.connections.get(userId) ?? 1;
    if (count <= 1) this.connections.delete(userId);
    else this.connections.set(userId, count - 1);
  }
}
```

## Multi-instance (Redis pub/sub)

Single instance Subject yeterli, multi-instance'da Redis bridge gerekli. Bkz. `event-bus.md`.

## Error handling

```typescript
import { catchError, retry } from "rxjs/operators";

events$.pipe(
  catchError(err => {
    logger.error("Stream error", err);
    return of({ type: "error", data: { message: "Stream failed, reconnecting" } });
  }),
);
```

Client side EventSource auto-reconnect — exponential backoff browser default.

## Disconnect detection

```typescript
@Sse("stream")
stream(@Req() req: Request): Observable<MessageEvent> {
  const userId = req.user.id;

  return this.events.forUser(userId).pipe(
    finalize(() => {
      logger.log(`Client disconnected: ${userId}`);
      this.connections.release(userId);
    }),
  );
}
```

`finalize` — observable complete OR client disconnect → cleanup.

## Use cases

### Notification stream
```typescript
@Sse("notifications")
notifications(@CurrentUser() user: User) {
  return this.events.forUser(user.id);
}
```

### Progress (long-running task)
```typescript
@Post("import")
async startImport(@Body() dto: ImportDto) {
  const jobId = await this.queue.enqueue("import", dto);
  return { jobId };
}

@Sse("import/:jobId")
importProgress(@Param("jobId") jobId: string) {
  return this.queue.progressFor(jobId).pipe(
    map(p => ({ type: "progress", data: p })),
  );
}
```

### Live logs
```typescript
@Sse("logs/:service")
logs(@Param("service") service: string) {
  return this.logService.tail(service);
}
```

### Real-time analytics
```typescript
@Sse("analytics/dashboard")
dashboard() {
  return interval(5000).pipe(
    mergeMap(() => from(this.analytics.snapshot())),
    map(data => ({ type: "snapshot", data })),
  );
}
```

## Anti-pattern'ler

### Sync work in stream
```typescript
return interval(100).pipe(
  map(() => {
    const heavyComputation = ...;   // blocks event loop
    return { data: heavyComputation };
  }),
);
```

→ Worker thread veya pre-compute.

### No heartbeat
30s+ idle → proxy disconnect → "stream broken" error.

### Memory leak (no cleanup)
`Subject.next` ediyor ama Observer unsubscribe etmiyor → memory grows.

### Auth via query param logged
```
GET /stream?token=eyJhbG...
→ Nginx access log: full token
```

Cookie veya short-lived token tercih.

### Multi-instance without Redis
Single instance'da Subject. 3 instance = 3 farklı Subject. User instance A'ya bağlanır, event instance B'de emit olur → user görmez.

## Aksiyon

1. NestJS `@Sse` decorator + `Observable<MessageEvent>`
2. EventStreamService — Subject pattern, filter by user
3. Heartbeat (15s) proxy timeout için
4. Cookie-based auth (header desteklenmez)
5. Backpressure: bufferTime / throttle
6. Connection limit per user
7. `finalize` cleanup — disconnect detection
8. Multi-instance → Redis pub/sub bridge
