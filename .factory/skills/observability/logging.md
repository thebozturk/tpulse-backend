---
name: observability-logging
keywords: "logging, pino, winston, structured, correlation, redact"
description: "Structured logging — pino, correlation ID, redaction"
---

# Logging

## Pino (önerilir)

Hızlı, structured (JSON), low overhead.

```bash
pnpm add nestjs-pino pino pino-http
```

```typescript
// main.ts
import { Logger as PinoLogger } from 'nestjs-pino';

const app = await NestFactory.create(AppModule, { bufferLogs: true });
app.useLogger(app.get(PinoLogger));
```

```typescript
// app.module.ts
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL || 'info',
        autoLogging: true,
        genReqId: (req) => req.headers['x-request-id'] || randomUUID(),
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.body.password',
            'req.body.refreshToken',
            '*.password',
            '*.token',
            '*.secret',
          ],
          censor: '***',
        },
        transport: process.env.NODE_ENV !== 'production'
          ? { target: 'pino-pretty' }
          : undefined,
      },
    }),
  ],
})
```

Production'da JSON log → log aggregator (Loki, Datadog) parse eder.

## Structured logging

```typescript
// ❌ String concat
logger.info(`User ${id} logged in from ${ip}`);

// ✓ Structured
logger.info({ userId: id, ip, action: 'login' }, 'User logged in');
```

JSON format:
```json
{
  "level": 30,
  "time": 1713712345,
  "userId": "...",
  "ip": "1.2.3.4",
  "action": "login",
  "msg": "User logged in",
  "reqId": "abc-123"
}
```

Query: `level=error AND userId=...`

## Log levels

- `trace` — debug detail (rare)
- `debug` — development debugging
- `info` — normal operations (login, payment)
- `warn` — degraded but OK (cache miss, retry)
- `error` — failure (exception, failed operation)
- `fatal` — process unrecoverable

Production: `info` default. Critical path debug açma (overhead).

## Correlation ID (request tracing)

Her request'e unique ID:
```typescript
// pinoHttp config'e zaten ekledik:
genReqId: (req) => req.headers['x-request-id'] || randomUUID()
```

Logger context'inde `reqId` otomatik. Distributed system'de upstream'den geç:
```typescript
// API call yaparken
await axios.get(url, { headers: { 'X-Request-ID': req.reqId } });
```

## PII redaction

ZORUNLU. Asla:
- Password
- Token / API key / secret
- Credit card
- SSN
- Email full (gerekirse hash)

`redact` paths config'i sıkı tut.

## Async logging

Pino async batch yazma:
```typescript
const logger = pino({
  // Buffer'a yaz, periodic flush
  // Default zaten async
});
```

Crash sırasında son log'lar kayıp olabilir. Critical event'ler `pino.flush()` ile force.

## Log aggregation

Production:
- Loki + Grafana (open source)
- Datadog
- ELK (Elasticsearch + Logstash + Kibana)
- CloudWatch (AWS)

Container log → stdout → log driver → aggregator.

## Anti-pattern'ler

### console.log
```typescript
console.log('debug');  // ❌
```
Logger inject. Post-write-check uyarır.

### Log spam
Her function'ın başında/sonunda log → noise. Sadece önemli event.

### Log'da PII
```typescript
logger.info({ user });  // ❌ password dahil
logger.info({ userId: user.id, email: user.email });  // ✓
```

## Aksiyon

1. nestjs-pino kur
2. Structured logging (object first)
3. Correlation ID (reqId)
4. PII redact zorunlu
5. Production: JSON, info level, Loki/Datadog
6. console.* yasak
