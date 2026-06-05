# Streaming Skills (Backend)

Real-time data delivery — server → client.

- [sse-emit.md](sse-emit.md) — Server-Sent Events (NestJS controller pattern)
- [websocket.md](websocket.md) — WebSocket gateway (NestJS @WebSocketGateway)
- [event-bus.md](event-bus.md) — Multi-instance event broadcasting (Redis pub/sub)

## SSE vs WebSocket — hangisi?

| Feature | SSE | WebSocket |
|---------|-----|-----------|
| Direction | Server → Client (1-way) | Bidirectional |
| Protocol | HTTP | Custom over TCP |
| Reconnect | Auto (browser native) | Manual |
| Proxy/firewall | Friendly (HTTP) | Sometimes blocked |
| Binary | No (text only) | Yes |
| Browser support | All modern | All modern |
| Backpressure | Limited | Better |
| Use case | Notifications, progress, logs | Chat, collab, gaming |

**Default**: SSE for simple server→client. WebSocket when bidirectional truly needed.
