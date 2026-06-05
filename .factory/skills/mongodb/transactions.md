---
name: mongodb-transactions
keywords: "transaction, session, replica set, ACID, atomic, rollback"
description: "Multi-document atomic operations"
---

# Transactions

## Ne zaman gerekli

Multi-document atomic yazma:
- Hesap transferi (A'dan çıkar, B'ye ekle)
- Sipariş + stok düşür
- Audit log + actual change

Single doküman zaten atomic — transaction **gerekmez**.

## Replica set gereksinimi

Standalone MongoDB'de transaction YOK. Replica set (1 primary + 2 secondary veya single-node replica set) gerekli.

### Local dev (single-node replica set)

```yaml
# docker-compose.yml
services:
  mongo:
    image: mongo:7
    command: ["--replSet", "rs0", "--bind_ip_all"]
    healthcheck:
      test: |
        mongosh --quiet --eval "try { rs.status() } catch(e) { rs.initiate() }"
      interval: 10s
      start_period: 30s
```

İlk boot'ta `rs.initiate()` kendi kendini starter. Bundan sonra transactions çalışır.

## Mongoose session pattern

```typescript
import { Connection } from 'mongoose';
import { InjectConnection } from '@nestjs/mongoose';

@Injectable()
export class AccountService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Account.name) private readonly accountModel: Model<Account>,
    @InjectModel(Transfer.name) private readonly transferModel: Model<Transfer>,
  ) {}

  async transfer(fromId: string, toId: string, amount: number): Promise<void> {
    const session = await this.connection.startSession();

    try {
      await session.withTransaction(async () => {
        // Sender balance kontrolü + düş
        const sender = await this.accountModel.findOneAndUpdate(
          { _id: fromId, balance: { $gte: amount } },
          { $inc: { balance: -amount } },
          { session, new: true },
        );

        if (!sender) {
          throw new BadRequestException('Insufficient balance');
        }

        // Receiver'a ekle
        await this.accountModel.updateOne(
          { _id: toId },
          { $inc: { balance: amount } },
          { session },
        );

        // Transfer kaydı
        await this.transferModel.create(
          [{ fromId, toId, amount, at: new Date() }],
          { session },
        );
      });
    } finally {
      await session.endSession();
    }
  }
}
```

## withTransaction — otomatik retry

`withTransaction` transient error'larda (write conflict) otomatik retry yapar. Manual:

```typescript
const session = await connection.startSession();
session.startTransaction();
try {
  // queries with { session }
  await session.commitTransaction();
} catch (err) {
  await session.abortTransaction();
  throw err;
} finally {
  await session.endSession();
}
```

`withTransaction` tercih — hem retry hem cleanup.

## Session'ı HER query'e geçir

```typescript
// ❌ Session unut → transaction dışında
await this.accountModel.updateOne(filter, update);

// ✓ Session
await this.accountModel.updateOne(filter, update, { session });
```

Unutursan o query transaction'da değil, atomic'lik bozulur.

## Read concern, write concern

```typescript
session.startTransaction({
  readConcern: { level: 'snapshot' },
  writeConcern: { w: 'majority', j: true },
  readPreference: 'primary',
});
```

- `snapshot` read: transaction başındaki state'i okur (tutarlı)
- `majority` write: majority node'a yazılana kadar bekle
- `j: true`: journal'a yazılsın (crash safety)

Default'lar genelde yeter. Finansal işlem için explicit belirt.

## Timeout

Transaction default 60 saniye. Daha uzun iş için:
```typescript
await session.withTransaction(async () => { ... }, {
  maxCommitTimeMS: 30_000,
});
```

Ama genelde 60s'den uzun transaction = refactor sinyali (batch'le, async process'e çek).

## Aynı collection'a concurrent write

Write conflict beklenir. `withTransaction` retry yapar (genelde 3 kez).

Yine de retry exhausted → caller'a error. Outer retry layer kurulabilir (resilience skill).

## Performance cost

Transaction pahalı:
- Extra round-trip (commit/abort)
- Lock'lama
- Replica sync bekleme

**Minimize:**
- Transaction içinde DB işlemi minimum
- Long-running logic (external API call vs.) transaction DIŞINDA
- Read'ler transaction dışında (outside transaction daha hızlı)

## Anti-pattern'ler

### Transaction içinde external API
```typescript
// ❌
await session.withTransaction(async () => {
  await this.paymentModel.create([...], { session });
  await stripe.charge(amount);  // external — transaction'ı tutar
});
```
External call'u ayrı yap, sonucu DB'ye yaz.

### Transaction içinde read
```typescript
// ❌ Gereksiz transaction
await session.withTransaction(async () => {
  const user = await userModel.findById(id, null, { session });  // read only
  return user;
});
```

### Session cleanup unut
```typescript
// ❌ Leak
const session = await connection.startSession();
// ... hata atar, endSession çağrılmaz
```

### Nested transaction
MongoDB nested transaction desteklemez. Aynı session'da iç içe değil.

## Aksiyon

1. Multi-doc atomic gerekliyse transaction
2. `withTransaction` tercih (auto retry)
3. Her query'de `{ session }` pas et
4. External call transaction dışında
5. Replica set ortamı zorunlu (dev dahil)
6. Session'ı `finally`'de endSession
