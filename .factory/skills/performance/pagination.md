---
name: performance-pagination
keywords: "pagination, deep page, cursor, performance"
description: "Deep pagination'ı önle — cursor pattern"
---

# Pagination Performance

## Deep page problem

`skip(10000).limit(20)` → MongoDB ilk 10000 doc'u tarar, atlar. **O(N+M)** complexity.

Page 1000+ → saniyeler.

## Cursor (önerilir)

```typescript
async list(cursor?: string, limit = 20) {
  const query: any = {};
  if (cursor) {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString());
    query._id = { $gt: new Types.ObjectId(decoded.id) };
  }

  const items = await this.model
    .find(query)
    .sort({ _id: 1 })
    .limit(limit + 1)
    .lean();

  const hasNext = items.length > limit;
  if (hasNext) items.pop();

  const nextCursor = hasNext
    ? Buffer.from(JSON.stringify({ id: items.at(-1)._id })).toString('base64')
    : null;

  return { items, nextCursor };
}
```

O(log N + M) — sabit hız.

## Compound cursor

Sort birden fazla field ise compound:
```typescript
sort({ createdAt: -1, _id: -1 })

// Cursor: { createdAt: ..., id: ... }
query.$or = [
  { createdAt: { $lt: cursor.createdAt } },
  { createdAt: cursor.createdAt, _id: { $lt: cursor.id } },
];
```

## Index zorunlu

Cursor sort field'ları index'lenmiş olmalı:
```typescript
PostSchema.index({ createdAt: -1, _id: -1 });
```

Yoksa cursor da yavaş.

## Total count

`countDocuments()` büyük collection'da yavaş. Approximate:
```typescript
await model.estimatedDocumentCount();
```

Ya da gösterme. "Page 1 of ?" yerine "Page 1, more pages" yeter.

## Aksiyon

- Büyük dataset → cursor
- Index sort field'lara
- Total count opsiyonel
- Bkz. `api/pagination.md` detay
