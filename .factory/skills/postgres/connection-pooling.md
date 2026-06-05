---
name: postgres-pooling
keywords: "pgbouncer, pool, connection, max_connections"
description: "Connection pooling — pgBouncer, Postgres limits"
---

# Connection Pooling

## Postgres connection cost

Her connection = ~10MB RAM + ~10ms TCP/auth handshake.

`max_connections` Postgres'te genelde 100. Production app 50+ instance ile direkt connect ederse:
- Memory exhaustion
- "too many connections" error
- Slow auth

**Çözüm**: Connection pool — N app instance → M pool worker → Postgres.

## pgBouncer

Lightweight connection pooler.

### docker-compose
```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: dev
    # No exposed port — only via pgBouncer

  pgbouncer:
    image: edoburu/pgbouncer:latest
    environment:
      DATABASE_URL: postgres://dev:dev@postgres:5432/app
      POOL_MODE: transaction
      MAX_CLIENT_CONN: 1000
      DEFAULT_POOL_SIZE: 20
    ports:
      - "6432:5432"
    depends_on:
      - postgres
```

App connects to `pgbouncer:6432` instead of `postgres:5432`.

## Pool modes

### Session (default Postgres)
Each client = dedicated connection until disconnect. Slowest, full feature.

### Transaction
Connection released after each transaction. Fastest, no LISTEN/prepared statements/temp tables.

### Statement
Connection released after each query. Even faster, no transactions support.

**Default**: Transaction mode. Prisma `pgbouncer=true` flag ile compat.

## Prisma + pgBouncer

```bash
# .env
DATABASE_URL="postgresql://dev:dev@bouncer:6432/app?pgbouncer=true&connection_limit=1"

# Migrations için direct (pgBouncer transaction mode incompatible w/ migrations)
DIRECT_URL="postgresql://dev:dev@postgres:5432/app"
```

```prisma
datasource db {
  provider     = "postgresql"
  url          = env("DATABASE_URL")
  directUrl    = env("DIRECT_URL")
}
```

`connection_limit=1` — Each Prisma instance reserves only 1 pgBouncer connection. Many app instances OK.

## Pool sizing

```
PostgreSQL max_connections = 100

pgBouncer:
  max_client_conn = 1000          (app side)
  default_pool_size = 20           (DB side per pool)
  reserve_pool_size = 5

App instances * connection_limit ≤ 1000
Total active queries ≤ 20 per pool
```

App instance count düşük → connection_limit yüksek olabilir (5-10).
App instance count yüksek (Lambda, K8s autoscale) → connection_limit=1 zorunlu.

## Connection lifecycle

```typescript
// PrismaService
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();   // graceful shutdown — connection returned to pool
  }
}
```

App restart → connections returned, no leak.

## Monitoring

### pgBouncer
```bash
psql "host=bouncer port=6432 dbname=pgbouncer" -c "SHOW POOLS"
```

```
| database | user | cl_active | cl_waiting | sv_active | sv_idle | sv_used |
| app      | dev  | 12        | 0          | 8         | 12      | 0       |
```

`cl_waiting > 0` — clients waiting for connection → pool small.
`sv_active = max` — DB saturated → scale up.

### Postgres
```sql
SELECT count(*), state FROM pg_stat_activity GROUP BY state;
```

```
| count | state              |
| 8     | active             |
| 12    | idle               |
| 2     | idle in transaction |
```

`idle in transaction` — transaction açık kalmış, connection lock. Code review gerekiyor.

## Anti-pattern'ler

### connection_limit too high
Lambda function 1000 instance × connection_limit=10 = 10K. pgBouncer max_client_conn aşılır.

### Direct connection production
```bash
DATABASE_URL="postgresql://dev:dev@postgres:5432/app"  # no pooler
```

→ "too many connections" at scale.

### Long-running transaction
```typescript
await prisma.$transaction(async (tx) => {
  const user = await tx.user.create(...);
  await externalApi.something();   // network
  return user;
});
// Connection blocked entire external call
```

External work transaction OUTSIDE.

### Forgot $disconnect
SIGINT/SIGTERM handler yoksa connection leak.

```typescript
process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
```

NestJS `OnModuleDestroy` automatic. Ama framework dışı code için manual.

## Cloud providers

### Vercel Postgres / Neon
Built-in pooler, `?sslmode=require` URL flag'i kullan.

### AWS RDS
RDS Proxy — pgBouncer alternative, AWS-managed.

### Supabase
Built-in pgBouncer at port 6543.

## Aksiyon

1. Production'da pgBouncer ZORUNLU (multi-instance app)
2. Transaction mode default
3. Prisma `pgbouncer=true` + `directUrl` migration için
4. connection_limit hesabı: instances × limit ≤ pgBouncer max
5. Monitor `pg_stat_activity` weekly
6. SIGTERM graceful disconnect
7. External calls transaction dışında
