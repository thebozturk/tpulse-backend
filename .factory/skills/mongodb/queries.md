---
name: mongodb-queries
keywords: "query, find, findOne, lean, select, populate, projection"
description: "Query patterns — lean, select, projection, populate"
---

# Queries

## lean() — performance killer'ın çözümü

### Default (Mongoose document)
```typescript
const user = await userModel.findById(id);
// Full Mongoose document: hydrate, change tracking, setters, virtuals
// Yavaş, memory ağır
```

### lean() (plain object)
```typescript
const user = await userModel.findById(id).lean();
// Plain JS object, sadece raw data
// 5-10x hızlı, 2-3x az memory
```

**Kullan:** Read-only, JSON response dönen her yerde.
**Kullanma:** `.save()` çağıracaksan (document metodları lean'de yok).

## Projection (select)

```typescript
// Sadece ihtiyacın olan field'ları
await userModel.findById(id).select('email name').lean();

// Exclude
await userModel.findById(id).select('-password -refreshToken').lean();

// Schema'da select:false varsa override
await userModel.findById(id).select('+password');
```

Network ve memory tasarrufu, hassas field leak önlemi.

## populate (join)

```typescript
// Single ref
await orderModel.findById(id).populate('userId').lean();
// order.userId: full User document

// Multiple
await orderModel.findById(id).populate(['userId', 'products']).lean();

// Specific fields
await orderModel.findById(id).populate('userId', 'email name').lean();

// Nested (dikkatli kullan!)
await orderModel.findById(id).populate({
  path: 'userId',
  populate: { path: 'teamId', select: 'name' },
});
```

**Max 1 seviye nesting**. Daha derin → aggregation.

## populate vs aggregation

Populate N+1 yapar:
```
1 ana query + N populate query = N+1 DB call
```

Aggregation tek pass:
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
  { $unwind: '$user' },
  { $project: { 'user.password': 0 } },
]);
```

Tek DB call, ama syntax karmaşık. Orta complexity için populate OK.

## findOne vs find().limit(1)

```typescript
// Equivalent
await userModel.findOne({ email });
await userModel.find({ email }).limit(1).then(arr => arr[0] || null);
```

`findOne` daha okunur. Performance aynı.

## exists() — "var mı?"

Sadece var mı kontrol:
```typescript
// ❌ Gereksiz data transfer
const user = await userModel.findOne({ email });
if (user) { ... }

// ✓ Hafif
const exists = await userModel.exists({ email });
if (exists) { ... }
```

Sadece `_id` döner — ağ trafiği minimum.

## countDocuments vs estimatedDocumentCount

```typescript
// Accurate count (filter-aware)
const n = await userModel.countDocuments({ status: 'active' });
// Büyük collection'da yavaş

// Tahmini (tüm collection)
const n = await userModel.estimatedDocumentCount();
// Metadata'dan — hızlı ama filter kabul etmez
```

## Update operations

### Tek field
```typescript
await userModel.updateOne(
  { _id: id },
  { $set: { lastLoginAt: new Date() } },
);
```

### Atomic increment
```typescript
await userModel.updateOne(
  { _id: id },
  { $inc: { loginCount: 1, balance: -10 } },
);
```

### Array push
```typescript
await userModel.updateOne(
  { _id: id },
  { $push: { tags: 'premium' } },
);

// Unique (varsa eklenmez)
await userModel.updateOne(
  { _id: id },
  { $addToSet: { tags: 'premium' } },
);
```

### Array pull
```typescript
await userModel.updateOne(
  { _id: id },
  { $pull: { tags: 'expired' } },
);
```

### findOneAndUpdate

Update + dönüş aynı call:
```typescript
const updated = await userModel.findOneAndUpdate(
  { _id: id },
  { $set: { status: 'active' } },
  { new: true }  // güncellenmiş doc dön (default: eski)
).lean();
```

## Bulk operations

N ayrı `updateOne` çağırmak yerine:
```typescript
await userModel.bulkWrite([
  { updateOne: { filter: { _id: 'a' }, update: { $set: { x: 1 } } } },
  { updateOne: { filter: { _id: 'b' }, update: { $set: { x: 2 } } } },
]);
```

10x-100x hızlı.

## Cursor (büyük dataset)

All at once → memory patlar:
```typescript
// ❌ 10M user'ı RAM'a yükler
const users = await userModel.find().lean();
```

Cursor:
```typescript
const cursor = userModel.find().cursor();
for await (const user of cursor) {
  // tek tek işle, memory sabit
}
```

## Session / transaction scope query

```typescript
const session = await connection.startSession();
await session.withTransaction(async () => {
  await userModel.updateOne({ _id }, { $inc: { balance: -100 } }, { session });
  await orderModel.create([{ userId: _id, amount: 100 }], { session });
});
```

**Session'ı unutma** — aksi halde transaction dışına çıkar.

## Anti-pattern'ler

### Tüm field'ları çek
```typescript
// ❌ Sadece email lazım ama password dahil her şey
const user = await userModel.findById(id);

// ✓
const user = await userModel.findById(id).select('email name').lean();
```

### lean() yok
```typescript
// ❌ Read-only ama Mongoose doc hydrate
const posts = await postModel.find().limit(100);
return posts;

// ✓
const posts = await postModel.find().limit(100).lean();
```

### N+1 with populate loop
```typescript
// ❌
const users = await userModel.find();
for (const u of users) {
  u.orders = await orderModel.find({ userId: u._id });  // N+1
}
```

### Sync forEach async
```typescript
// ❌ Promise'ler ignore
users.forEach(async (u) => { await u.save(); });

// ✓
await Promise.all(users.map(u => u.save()));
```

## Aksiyon

- Read → `lean()`
- `select()` ile sadece ihtiyaç
- Populate 1 seviye max, daha derin → aggregation
- Atomic update: `$inc`, `$set`, `$push`
- Bulk ile batch
- Cursor ile large iteration
- Transaction için session her query'e geçir
