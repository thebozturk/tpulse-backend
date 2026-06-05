---
name: streaming-websocket
keywords: "websocket, gateway, socket.io, ws, bidirectional"
description: "NestJS WebSocket gateway — bidirectional"
---

# WebSocket (NestJS Gateway)

Bidirectional, full-duplex. Use case: chat, collaboration, gaming.

## NestJS — Socket.IO

```bash
pnpm add @nestjs/websockets @nestjs/platform-socket.io socket.io
pnpm add -D @types/ws
```

## Gateway

```typescript
// src/chat/chat.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from "@nestjs/websockets";
import { Logger } from "@nestjs/common";
import { Server, Socket } from "socket.io";

@WebSocketGateway({
  namespace: "chat",
  cors: { origin: process.env.FRONTEND_URL, credentials: true },
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server!: Server;

  afterInit(server: Server) {
    this.logger.log("WebSocket server ready");
  }

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token;
      const user = await this.verifyToken(token);
      client.data.userId = user.id;

      // Per-user room
      client.join(`user:${user.id}`);

      this.logger.log(`Connected: ${user.id}`);
    } catch (err) {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Disconnected: ${client.data.userId}`);
  }

  @SubscribeMessage("send_message")
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; text: string },
  ) {
    const userId = client.data.userId;

    // Validate
    if (!data.roomId || !data.text) {
      return { event: "error", data: { code: "INVALID_PAYLOAD" } };
    }

    // Persist
    const message = await this.chatService.send({
      userId,
      roomId: data.roomId,
      text: data.text,
    });

    // Broadcast to room
    this.server.to(`room:${data.roomId}`).emit("new_message", message);

    return { event: "message_sent", data: { id: message.id } };
  }

  @SubscribeMessage("join_room")
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const userId = client.data.userId;

    // Authorize
    const canAccess = await this.chatService.canAccessRoom(userId, data.roomId);
    if (!canAccess) {
      return { event: "error", data: { code: "FORBIDDEN" } };
    }

    client.join(`room:${data.roomId}`);
    return { event: "joined", data: { roomId: data.roomId } };
  }

  // Server-initiated emit
  notifyUser(userId: string, event: string, data: unknown) {
    this.server.to(`user:${userId}`).emit(event, data);
  }
}
```

## Module

```typescript
@Module({
  providers: [ChatGateway, ChatService],
  exports: [ChatGateway],
})
export class ChatModule {}
```

## Auth flow

### Connection auth (recommended)
Client'ta:
```typescript
const socket = io("https://api.acme.com/chat", {
  auth: { token: "JWT_HERE" },
});
```

`handleConnection`:
```typescript
async handleConnection(client: Socket) {
  const token = client.handshake.auth.token;
  // verify, attach user to client.data, or disconnect
}
```

### Cookie auth
```typescript
const socket = io("https://api.acme.com/chat", {
  withCredentials: true,
});
```

```typescript
async handleConnection(client: Socket) {
  const cookies = parseCookie(client.handshake.headers.cookie);
  const user = await this.verifyToken(cookies.access_token);
  // ...
}
```

## Rooms

Socket.IO room — user grouping.

```typescript
client.join(`user:${userId}`);          // per-user
client.join(`room:${roomId}`);          // group
client.join(`org:${orgId}`);            // tenant
```

```typescript
this.server.to(`room:${roomId}`).emit(event, data);   // broadcast to room
this.server.to(`user:${userId}`).emit(event, data);   // single user
this.server.except(client.id).emit(...);              // all except sender
this.server.emit(...);                                  // all connected
```

## Message validation

```typescript
import { z } from "zod";
import { WsException } from "@nestjs/websockets";

const sendMessageSchema = z.object({
  roomId: z.string().min(1),
  text: z.string().min(1).max(2000),
});

@SubscribeMessage("send_message")
async handle(@MessageBody() raw: unknown, @ConnectedSocket() client: Socket) {
  const result = sendMessageSchema.safeParse(raw);
  if (!result.success) {
    throw new WsException({ code: "VALIDATION", details: result.error.flatten() });
  }
  // ... use result.data
}
```

## Rate limiting

```typescript
import { Injectable } from "@nestjs/common";

@Injectable()
export class WsRateLimit {
  private map = new Map<string, { count: number; resetAt: number }>();

  check(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const entry = this.map.get(key);
    if (!entry || entry.resetAt < now) {
      this.map.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (entry.count >= limit) return false;
    entry.count++;
    return true;
  }
}
```

```typescript
@SubscribeMessage("send_message")
async handle(@ConnectedSocket() client: Socket, @MessageBody() data: any) {
  if (!this.rateLimit.check(`send:${client.data.userId}`, 10, 1000)) {
    throw new WsException({ code: "RATE_LIMITED" });
  }
  // ...
}
```

10 message / 1s.

## Multi-instance — Socket.IO Redis adapter

Single instance OK, multi-instance'da Redis adapter ile broadcast cross-instance:

```bash
pnpm add @socket.io/redis-adapter ioredis
```

```typescript
import { IoAdapter } from "@nestjs/platform-socket.io";
import { ServerOptions, Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { Redis } from "ioredis";

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor!: ReturnType<typeof createAdapter>;

  async connectToRedis(): Promise<void> {
    const pubClient = new Redis(process.env.REDIS_URL!);
    const subClient = pubClient.duplicate();
    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}

// main.ts
const app = await NestFactory.create(AppModule);
const adapter = new RedisIoAdapter(app);
await adapter.connectToRedis();
app.useWebSocketAdapter(adapter);
```

Şimdi `server.to(room).emit(...)` her instance'a broadcast → tüm subscriber'lar görür.

## Reconnection (client side)

Socket.IO auto-reconnect:
```typescript
const socket = io(url, {
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
});
```

State recovery (Socket.IO v4.6+):
```typescript
// Server
@WebSocketGateway({
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000,   // 2 min
    skipMiddlewares: true,
  },
})
```

Disconnect <2 min ise mesajlar buffer'da kalır, reconnect'te delivered.

## Security

### CORS
```typescript
@WebSocketGateway({
  cors: {
    origin: ["https://acme.com", "https://app.acme.com"],
    credentials: true,
  },
})
```

`origin: "*"` PRODUCTION'da YASAK.

### Origin check
```typescript
async handleConnection(client: Socket) {
  const origin = client.handshake.headers.origin;
  if (!ALLOWED_ORIGINS.includes(origin!)) {
    client.disconnect(true);
    return;
  }
}
```

### Per-message authorization
Connection authenticated ama her message için resource access check:
```typescript
@SubscribeMessage("send_message")
async handle(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
  const canSend = await this.chat.canSendToRoom(client.data.userId, data.roomId);
  if (!canSend) throw new WsException({ code: "FORBIDDEN" });
  // ...
}
```

## Anti-pattern'ler

### Connection without auth
Anyone can connect. Must verify in `handleConnection`.

### Server emit without room
```typescript
this.server.emit("message", data);   // ❌ broadcasts to ALL clients
```

→ User-specific room.

### No rate limit
Spam attack possible. Per-user rate limit zorunlu.

### Acks ignored
```typescript
client.emit("event", data);   // server'da listener varsa client'a ack döner mi?
// Default Socket.IO: optional ack
```

Critical message için ack pattern + retry.

### Multi-instance no Redis
Different connection different instance — events lost.

## Aksiyon

1. `@WebSocketGateway` namespace + CORS
2. handleConnection — auth ZORUNLU
3. Per-user room (`user:${id}`) for direct broadcast
4. zod validation @MessageBody
5. Rate limit per-message per-user
6. Multi-instance → Redis adapter
7. Connection recovery (Socket.IO 4.6+)
