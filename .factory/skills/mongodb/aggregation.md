---
name: mongodb-aggregation
keywords: "aggregation, pipeline, lookup, group, match, project, unwind"
description: "Aggregation pipeline — karmaşık query'ler, join, group"
---

# Aggregation

## Ne zaman

- Karmaşık query: group, count, sum, avg
- Multi-collection join (`$lookup`)
- Data transformation (reshape response)
- Complex filtering + sort

Basit CRUD için: `find()`, `findOne()`, `updateOne()` — aggregation değil.

## Pipeline stages (en sık)

### $match — filter
```typescript
{ $match: { status: 'active', createdAt: { $gte: lastMonth } } }
```

**Pipeline'ın BAŞINA koy** — index kullanır, sonraki stage'lere az doküman gider.

### $project — reshape
```typescript
{ $project: { name: 1, email: 1, _id: 0 } }  // include
{ $project: { password: 0 } }                  // exclude
{ $project: {
    fullName: { $concat: ['$firstName', ' ', '$lastName'] },
    ageYears: { $divide: [{ $subtract: [new Date(), '$birthDate'] }, 365*24*3600*1000] }
}}
```

### $sort
```typescript
{ $sort: { createdAt: -1, name: 1 } }
```

Sort index'siz büyük dataset'te memory limit'e takılır (100MB). `allowDiskUse: true` option.

### $limit, $skip
```typescript
{ $skip: 20 },
{ $limit: 10 },
```

Pagination için. Büyük skip yine yavaş (bkz. `api/pagination.md` → cursor).

### $group
```typescript
{
  $group: {
    _id: '$status',          // group by field
    count: { $sum: 1 },       // count
    totalSpent: { $sum: '$amount' },
    avgOrder: { $avg: '$amount' },
    names: { $push: '$name' },
    emails: { $addToSet: '$email' },
  }
}
```

### $lookup (join)
```typescript
{
  $lookup: {
    from: 'users',
    localField: 'userId',
    foreignField: '_id',
    as: 'user',
  }
}
```

Sonuç: her doküman'a `user: [...]` array eklenir.

### $unwind
```typescript
{ $unwind: '$user' }
// array → single object, her array item için ayrı doküman
```

`$lookup` sonrası tek eleman varsa unwind ile düzleştir.

### $count
```typescript
{ $count: 'total' }
// { total: N }
```

## Örnek: User + son sipariş toplamı

```typescript
await userModel.aggregate([
  { $match: { status: 'active' } },
  {
    $lookup: {
      from: 'orders',
      let: { userId: '$_id' },
      pipeline: [
        { $match: {
          $expr: { $eq: ['$userId', '$$userId'] },
          createdAt: { $gte: lastMonth },
        }},
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ],
      as: 'stats',
    },
  },
  {
    $project: {
      email: 1,
      name: 1,
      orderTotal: { $ifNull: [{ $arrayElemAt: ['$stats.total', 0] }, 0] },
      orderCount: { $ifNull: [{ $arrayElemAt: ['$stats.count', 0] }, 0] },
    },
  },
  { $sort: { orderTotal: -1 } },
  { $limit: 10 },
]);
```

Top 10 spender. Tek DB call.

## Performance kuralları

### 1. $match ilk

```typescript
// ❌
[
  { $project: { ... } },
  { $match: { status: 'active' } }  // önce 1M doc project, sonra filter
]

// ✓
[
  { $match: { status: 'active' } },  // index kullanır, 10k'ya düşer
  { $project: { ... } }
]
```

### 2. $limit erken

```typescript
[
  { $match: ... },
  { $sort: ... },
  { $limit: 10 },       // 10 sonrası stage'ler 10 üstünde çalışır
  { $lookup: ... },
]
```

### 3. $lookup pahalı

Her `$lookup` = DB'ye ek call. Mümkünse önce filtre, sonra lookup.

```typescript
{
  $lookup: {
    from: 'orders',
    let: { userId: '$_id' },
    pipeline: [
      { $match: { $expr: { $eq: ['$userId', '$$userId'] } } },
      { $limit: 5 },  // sub-pipeline'da da limit
    ],
    as: 'orders',
  }
}
```

### 4. Index kullanımı

`explain()`:
```typescript
const explain = await orderModel.aggregate([...]).explain();
console.log(explain[0].stages);
```

İlk stage index kullanıyor mu kontrol.

### 5. allowDiskUse

Büyük sort / group memory limit aşarsa:
```typescript
await model.aggregate([...]).option({ allowDiskUse: true });
```

Disk kullanır, yavaş ama çalışır.

## Faceted search (çok kategorili filter)

```typescript
await productModel.aggregate([
  { $match: { active: true } },
  {
    $facet: {
      byCategory: [
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ],
      byPriceRange: [
        {
          $bucket: {
            groupBy: '$price',
            boundaries: [0, 100, 500, 1000, Infinity],
            default: 'other',
            output: { count: { $sum: 1 } },
          },
        },
      ],
      items: [
        { $sort: { createdAt: -1 } },
        { $skip: 0 },
        { $limit: 20 },
      ],
    },
  },
]);
```

Tek call ile: kategori dağılımı + fiyat dağılımı + sayfa item'ları.

## Anti-pattern'ler

### Client-side aggregation
```typescript
// ❌ Tüm user'ı çek, JS'te grupla
const users = await userModel.find().lean();
const byStatus = _.groupBy(users, 'status');

// ✓ DB'de $group
await userModel.aggregate([
  { $group: { _id: '$status', count: { $sum: 1 } } },
]);
```

### $lookup'ın altında $match yok
```typescript
// ❌ Tüm orders'ı joinler, sonra filter
[{ $lookup: {...}}, { $match: {...}}]

// ✓ Sub-pipeline ile join sırasında filter
[{ $lookup: { pipeline: [{ $match: {...} }, ...], as: 'orders' }}]
```

### $group'tan sonra büyük data
`$group` output'u tek instance'ta tutar. `nDistinct * resultSize > 100MB` → fail.

### Pipeline stage sıralama yanlış
Sort - match - limit sıralaması performance farkı yaratır. ESR rule gibi düşün.

## Aksiyon

1. Basit query için `find()`, aggregation kullanma
2. Multi-collection gerektiyse `$lookup`
3. Group/count/sum için aggregation
4. `$match` ilk, `$limit` erken
5. `.explain()` ile index kullanımı doğrula
6. Memory aşarsa `allowDiskUse`
