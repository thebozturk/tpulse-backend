---
name: performance-n-plus-one
keywords: "N+1, populate, batch, dataloader"
description: "N+1 query problem ve çözümleri"
---

> **Stack-aware:** Bu skill Mongoose populate üzerinden N+1'i anlatır. Prisma + PostgreSQL projelerinde aynı problem `prisma/performance.md` (include vs select, DataLoader pattern, connection pool) ve `postgres/indexes.md`'de işlenir.


# N+1 Query Problem

## Sorun

```typescript
const users = await userModel.find().limit(100);  // 1 query
for (const u of users) {
  u.orders = await orderModel.find({ userId: u._id });  // 100 query
}
// Toplam: 1 + 100 = 101 query
```

`N+1`: 1 ana query + N child query.

## Çözümler

### 1. populate (Mongoose)

```typescript
// ❌ N+1
const orders = await orderModel.find();
for (const o of orders) {
  o.user = await userModel.findById(o.userId);
}

// ✓ Tek extra query
const orders = await orderModel.find().populate('userId').lean();
```

Mongoose 1 ek query: `users where _id IN [ids]`. Total: 2 query.

### 2. $lookup (aggregation)

```typescript
await orderModel.aggregate([
  { $match: { status: 'pending' } },
  {
    $lookup: {
      from: 'users',
      localField: 'userId',
      foreignField: '_id',
      as: 'user',
    },
  },
]);
```

Tek aggregation, server-side join.

### 3. DataLoader (request-scoped batch)

```bash
pnpm add dataloader
```

```typescript
@Injectable({ scope: Scope.REQUEST })
export class UserLoader {
  loader: DataLoader<string, User>;

  constructor(@InjectModel(User.name) private model: Model<User>) {
    this.loader = new DataLoader(async (ids: readonly string[]) => {
      const users = await this.model.find({ _id: { $in: [...ids] } }).lean();
      const map = new Map(users.map(u => [u._id.toString(), u]));
      return ids.map(id => map.get(id) || null);
    });
  }
}

// Service'te
async function getOrderWithUser(orderId: string) {
  const order = await orderModel.findById(orderId);
  const user = await userLoader.loader.load(order.userId);  // batch'lenir
  return { order, user };
}
```

100 farklı `.load(id)` call → 1 batch DB query.

GraphQL'de defaultu DataLoader.

## Anti-pattern'ler

### Loop içinde await DB call
```typescript
for (const item of items) {
  await dbCall(item);  // ❌ N+1
}
```

### populate 2+ seviye
```typescript
.populate({ path: 'a', populate: { path: 'b', populate: { path: 'c' }}})
// ❌ 4 query
```

Aggregation'a geç.

## Aksiyon

- Loop içinde DB call'a dikkat
- populate (1 seviye)
- Aggregation $lookup (multi-collection)
- DataLoader request-scoped batch
