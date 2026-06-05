---
name: postgres-transactions
keywords: "transaction, isolation, deadlock, advisory lock, ACID"
description: "Transactions — isolation levels, deadlock, locks"
---

# Transactions

## Isolation levels (4)

| Level | Phantom | Non-repeatable | Dirty | Default? |
|-------|---------|----------------|-------|----------|
| Read Uncommitted | ✓ | ✓ | ✓ | – |
| **Read Committed** | ✓ | ✓ | ✗ | Postgres |
| Repeatable Read | ✓ | ✗ | ✗ | – |
| Serializable | ✗ | ✗ | ✗ | – |

Postgres: Read Committed default. Read Uncommitted = Read Committed (Postgres'te eşdeğer).

### Read Committed (default)
Same transaction içinde 2 kez aynı query → farklı sonuç olabilir (başka transaction commit etmiş).

### Repeatable Read
Same transaction içinde aynı query = aynı snapshot. Phantom read mümkün (yeni row görünür).

### Serializable
Tam izolasyon. Concurrent transaction'lar çakışınca biri abort edilir. Retry gerekli.

## Prisma'da

```typescript
import { Prisma } from "@prisma/client";

await prisma.$transaction(
  async (tx) => {
    // ...
  },
  {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  },
);
```

## Use cases

### Read Committed (default) — most workload
Standard CRUD, list queries.

### Repeatable Read — report generation
Long-running query, snapshot consistency önemli:
```typescript
await prisma.$transaction(
  async (tx) => {
    const users = await tx.user.count();
    const posts = await tx.post.count();
    const ratio = users / posts;
    return ratio;
  },
  { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
);
```

### Serializable — financial / critical
Transfer, inventory deduction:
```typescript
async function transferFunds(fromId: string, toId: string, amount: Decimal) {
  return prisma.$transaction(
    async (tx) => {
      const from = await tx.account.findUniqueOrThrow({ where: { id: fromId } });
      if (from.balance.lt(amount)) throw new Error("Insufficient");

      await tx.account.update({
        where: { id: fromId },
        data: { balance: { decrement: amount } },
      });
      await tx.account.update({
        where: { id: toId },
        data: { balance: { increment: amount } },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
```

Serializable abort olabilir → retry wrapper:
```typescript
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (err.code === "40001" /* serialization_failure */ && i < maxRetries - 1) {
        await sleep(2 ** i * 100);
        continue;
      }
      throw err;
    }
  }
  throw new Error("Max retries exceeded");
}

await withRetry(() => transferFunds(...));
```

## Deadlock

Two transactions waiting on each other:
```
T1: lock A → wait for B
T2: lock B → wait for A
→ deadlock
```

Postgres detects, kills one (random). Error code `40P01`.

### Prevention

**Same lock order**:
```typescript
// Always lock by sorted ID
const ids = [fromId, toId].sort();
for (const id of ids) {
  await tx.account.update({ where: { id }, data: { /* lock */ } });
}
```

### Detection
```sql
SELECT * FROM pg_locks WHERE NOT granted;
```

## Row-level locking

### SELECT FOR UPDATE
```typescript
// Prisma — requires raw
await tx.$queryRaw`SELECT * FROM accounts WHERE id = ${id} FOR UPDATE`;

// Or use Prisma's atomic operations
await tx.account.update({
  where: { id },
  data: { balance: { decrement: amount } },   // atomic — no explicit lock
});
```

### FOR UPDATE SKIP LOCKED (queue pattern)
```sql
SELECT * FROM jobs
WHERE status = 'pending'
FOR UPDATE SKIP LOCKED
LIMIT 1;
```

Worker pool pattern — concurrent worker'lar farklı job alır, lock'lanmaz.

## Advisory locks (application-level)

Custom lock identifier:
```typescript
// Acquire (blocking)
await prisma.$queryRaw`SELECT pg_advisory_lock(${lockId})`;

// Try acquire (non-blocking)
const [{ pg_try_advisory_lock: acquired }] = await prisma.$queryRaw<[{ pg_try_advisory_lock: boolean }]>`
  SELECT pg_try_advisory_lock(${lockId})
`;

if (!acquired) {
  throw new Error("Job already running");
}

try {
  // Critical section
} finally {
  await prisma.$queryRaw`SELECT pg_advisory_unlock(${lockId})`;
}
```

Use case: Singleton job (cron, background task) — multiple worker'ı koordine et.

## Transaction-level vs session-level advisory

```sql
pg_advisory_lock(id)              -- session, manuel unlock
pg_advisory_xact_lock(id)         -- transaction, auto-release on commit/rollback
```

Transaction-level safer — connection error olursa otomatik release.

## Save points (nested transactions)

```typescript
await prisma.$transaction(async (tx) => {
  await tx.user.create({ data: { email: "1" } });

  try {
    await tx.$queryRaw`SAVEPOINT before_risky`;
    await tx.user.create({ data: { email: "1" } });   // duplicate — fails
  } catch (e) {
    await tx.$queryRaw`ROLLBACK TO SAVEPOINT before_risky`;
    // Outer transaction continues
  }

  await tx.user.create({ data: { email: "2" } });
});
```

## Long transaction problems

`idle in transaction` — transaction açık ama no work:
- Connection lock
- Vacuum prevented
- Bloat increases

Mitigation:
```sql
-- postgresql.conf
idle_in_transaction_session_timeout = 60000   -- 60s, kill idle txns
statement_timeout = 30000                       -- 30s, kill long queries
```

## Anti-pattern'ler

### External call in transaction
```typescript
await prisma.$transaction(async (tx) => {
  const order = await tx.order.create({ data });
  await stripeApi.charge(...);   // 5s network — connection lock
});
```

External outside:
```typescript
const order = await prisma.order.create({ data, status: "PENDING" });
const charge = await stripeApi.charge(...);
await prisma.order.update({ where: { id: order.id }, data: { status: "PAID" } });
```

### Nested $transaction
```typescript
await prisma.$transaction(async (tx) => {
  await prisma.$transaction(async (tx2) => {   // ❌
    // ...
  });
});
```

Prisma'da transactional savepoint native yok — savepoint manuel SQL.

### Forgot retry on serializable
Serializable abort etmek normal. Retry yoksa user'a 500 error.

### Default isolation for everything
Mass workload Read Committed (default). Sadece truly critical için Serializable.

### Lock order inconsistent
```typescript
// Worker A: locks user → product
// Worker B: locks product → user
// → deadlock
```

App-wide convention: hep ID sıralı.

## Aksiyon

1. Default Read Committed (Postgres default)
2. Critical financial → Serializable + retry
3. Long aggregation → Repeatable Read
4. Worker queue → `FOR UPDATE SKIP LOCKED`
5. Singleton job → advisory lock (xact-level)
6. External call ASLA transaction içinde
7. Same lock order convention deadlock prevent
8. `idle_in_transaction_session_timeout` configure
