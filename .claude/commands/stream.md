# /stream — Real-time stream endpoint scaffold

Argument: `<event-name>` — örn. `notifications`, `import-progress`, `chat`

Context bütçesi: 12k token

## Ne yapar

NestJS controller'a SSE veya WebSocket endpoint ekler. Use case'e göre:

- **SSE** — server→client one-way (notification, progress, log)
- **WebSocket** — bidirectional (chat, collab, gaming)

## Workflow

```
1. ask: "Stream type?
   1. SSE (server→client, basit, HTTP-friendly)
   2. WebSocket (bidirectional, low-latency)"

2. SSE seçilirse:
   - Read .factory/skills/streaming/sse-emit.md
   - EventStreamService varsa skip, yoksa oluştur
   - Controller'a @Sse('<event-name>') endpoint ekle
   - Per-user filter (CurrentUser decorator)
   - Heartbeat 15s
   - Auth guard (cookie-based)

3. WebSocket seçilirse:
   - Read .factory/skills/streaming/websocket.md
   - pnpm add @nestjs/websockets @nestjs/platform-socket.io socket.io
   - <EventName>Gateway oluştur
   - handleConnection auth
   - @SubscribeMessage handler'lar
   - Per-user room
   - Multi-instance ise: ask Redis adapter eklensin mi

4. Multi-instance check:
   - .factory/memory/conventions.json'da multiInstance: true ise
   - Read .factory/skills/streaming/event-bus.md
   - EventBusService (Redis pub/sub) ekle
```

## SSE template (üretilen)

```typescript
// src/<domain>/events.controller.ts
import { Controller, Sse, MessageEvent, UseGuards } from "@nestjs/common";
import { Observable, merge, interval, map } from "rxjs";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { EventStreamService } from "../events/event-stream.service";

@Controller("<event-name>")
@UseGuards(JwtAuthGuard)
export class <EventName>Controller {
  constructor(private events: EventStreamService) {}

  @Sse()
  stream(@CurrentUser() user: User): Observable<MessageEvent> {
    const events$ = this.events.forUser(user.id);
    const heartbeat$ = interval(15000).pipe(
      map(() => ({ type: "heartbeat", data: { ts: Date.now() } })),
    );
    return merge(events$, heartbeat$);
  }
}
```

## WebSocket template (üretilen)

```typescript
// src/<domain>/<domain>.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { z } from "zod";

@WebSocketGateway({
  namespace: "<event-name>",
  cors: { origin: process.env.FRONTEND_URL, credentials: true },
})
export class <EventName>Gateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token;
      const user = await this.verifyToken(token);
      client.data.userId = user.id;
      client.join(`user:${user.id}`);
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    // Cleanup logic
  }

  @SubscribeMessage("ping")
  handlePing(@MessageBody() data: unknown) {
    const schema = z.object({ ts: z.number() });
    const parsed = schema.parse(data);
    return { event: "pong", data: { serverTs: Date.now(), clientTs: parsed.ts } };
  }
}
```

## Auth guard ZORUNLU

SSE: cookie-based (EventSource header desteklemez)
WebSocket: handshake.auth.token veya cookie

Auth olmadan endpoint açma — anonymous abuse riski.

## Multi-instance event bridge

Birden fazla NestJS instance varsa Redis pub/sub gerekli:

```typescript
// EventBusService onModuleInit'te Redis subscribe
// Service emit → Redis publish → tüm instance'lar listen
// Bkz. .factory/skills/streaming/event-bus.md
```

`.factory/memory/conventions.json`'da `multiInstance: true` ise auto-add.

## Frontend pair

Backend stream endpoint açıldıktan sonra frontend'de consume:

```
Frontend tarafında: /stream-hook <event-name>
- SSE consume hook üretir
- WebSocket subscribe hook üretir
```

## Output format

```
✓ Stream endpoint created: /<event-name> (SSE)
✓ Files:
  - src/<domain>/events.controller.ts
  - src/events/event-stream.service.ts (yeni / mevcut)
  - src/events/event-stream.module.ts

Test:
  curl -N -H "Cookie: access_token=..." http://localhost:3000/<event-name>

Frontend:
  /stream-hook <event-name> ile EventSource hook'u oluştur
```

## YAPMA

- Auth olmadan endpoint
- Heartbeat unutma (proxy timeout)
- Per-user filter olmadan global event broadcast (privacy leak)
- $sse decorator'da sync heavy work (event loop block)
- Multi-instance'da single instance Subject (scaling fail)
- WebSocket CORS `*` production'da
