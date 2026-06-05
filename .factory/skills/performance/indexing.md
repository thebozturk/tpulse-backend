---
name: performance-indexing
keywords: "index, query plan, explain, slow query"
description: "Index analiz ve performance"
---

> **Stack-aware:** Bu skill MongoDB index'lerini anlatır (compound, ttl, sparse). Prisma+PostgreSQL projelerinde `postgres/indexes.md` (B-tree, GIN, partial, expression, INCLUDE covering) detaylıdır.


# Indexing Performance

## explain() ile analiz

```typescript
const explain = await userModel
  .find({ status: 'active' })
  .sort({ createdAt: -1 })
  .explain('executionStats');

console.log(explain.executionStats);
```

Önemli alanlar:
- `executionTimeMillis` — query süresi
- `totalDocsExamined` — kaç doc tarandı
- `totalKeysExamined` — kaç index entry
- `nReturned` — kaç doc döndü
- `winningPlan.stage` — `IXSCAN` (good) veya `COLLSCAN` (kötü)

**Hedef:** `totalDocsExamined / nReturned ≈ 1` — sadece gereken okundu.

## Slow query log

MongoDB profiler:
```javascript
// mongo shell
db.setProfilingLevel(1, { slowms: 100 });  // 100ms+ log
```

Query'ler `system.profile` collection'ına. Duration sort, optimize.

## Index hits

```typescript
// MongoDB stats
db.users.stats();
// indexSizes — her index'in disk kullanımı
```

Kullanılmayan index → disk + write cost. Sil.

## Common pitfalls

### Lead field'sız sort
```typescript
// Index: { status: 1, createdAt: -1 }
// Query: sort by createdAt only
.sort({ createdAt: -1 })  // index kullanmaz, status leadingfield
```

### Range + sort + equality bozuk sıra
```typescript
// Index: { age: 1, status: 1 }  ← ESR ihlali (range önce)
// Query: { status: 'active', age: { $gt: 18 } }  → kötü
// Fix: { status: 1, age: 1 }  → ESR doğru
```

## Hot indexes

Her schema için baseline:
- `_id` (auto)
- Frequent filter
- Sort field
- Unique field

Detay: `mongodb/indexes.md`

## Aksiyon

- explain('executionStats') ile her slow query
- Profiler ile slow query log
- ESR rule compound index
- Kullanılmayan index sil
