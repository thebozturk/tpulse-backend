---
name: api-pagination
keywords: "pagination, page, cursor, limit, offset, infinite scroll"
description: "Offset vs cursor pagination, performance considerations"
---

# Pagination

## İki ana yaklaşım

### Offset pagination (basit)

```
GET /users?page=2&pageSize=20

Response:
{
  data: [...],
  meta: {
    page: 2,
    pageSize: 20,
    total: 500,
    totalPages: 25,
    hasNext: true,
    hasPrev: true
  }
}
```

MongoDB:
```typescript
const skip = (page - 1) * pageSize;
const [items, total] = await Promise.all([
  this.model.find(filter).skip(skip).limit(pageSize).lean(),
  this.model.countDocuments(filter),
]);
```

**Pros:** Total sayı, page jumping (doğrudan sayfa 15'e), standart UI.

**Cons:**
- `skip(10000)` yavaş — MongoDB her birini atlamak zorunda
- Concurrent insertion ile duplicate/missing (page 2 çekerken yeni eklenir, sonraki page'de geri görür)
- Sayfa 100+'da performans patlar

**Ne zaman:** Küçük dataset (<10k), admin panel, arama sonucu (20-100 sayfa).

### Cursor pagination (scale)

```
GET /users?cursor=<opaque>&limit=20

Response:
{
  data: [...],
  meta: {
    nextCursor: "eyJpZCI6IjY1ZjdiM2E5In0=",
    hasNext: true
  }
}
```

Cursor: son item'in id'si (veya compound key encode'ed). Sonraki request'te `_id > cursor` query'lenir.

MongoDB:
```typescript
const query = filter;
if (cursor) {
  const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString());
  query._id = { $gt: new Types.ObjectId(decoded.id) };
}

const items = await this.model.find(query)
  .sort({ _id: 1 })
  .limit(limit + 1)  // one extra to check hasNext
  .lean();

const hasNext = items.length > limit;
if (hasNext) items.pop();

const nextCursor = hasNext
  ? Buffer.from(JSON.stringify({ id: items[items.length - 1]._id })).toString('base64')
  : null;
```

**Pros:**
- Sabit O(log N) — sayfa 10.000 bile hızlı
- Concurrent insertion ile consistent
- Infinite scroll UI'a ideal

**Cons:**
- Page jumping yok (sayfa 15'e git imkansız)
- Total count yok (opsiyonel ayrı call)
- Sort değişimi → cursor invalid

**Ne zaman:** Büyük dataset, feed, infinite scroll, activity log.

## Limit kontrolü

Hardcoded max — DoS önlemi:
```typescript
@IsInt() @Min(1) @Max(100)
limit: number = 20;
```

100'den fazla → 400 dön. Kullanıcı 10.000 item istemesin.

## Response meta

### Offset
```json
{
  "data": [...],
  "meta": {
    "page": 2,
    "pageSize": 20,
    "total": 500,
    "totalPages": 25,
    "hasNext": true,
    "hasPrev": true
  }
}
```

### Cursor
```json
{
  "data": [...],
  "meta": {
    "nextCursor": "base64-encoded",
    "prevCursor": null,
    "hasNext": true,
    "limit": 20
  }
}
```

## Compound cursor

Sort field birden fazla ise cursor compound olmalı:
```typescript
// sort: createdAt desc, then _id desc
sort({ createdAt: -1, _id: -1 })

// cursor
{ createdAt: '2026-04-21T...', id: '65f...' }
query = {
  $or: [
    { createdAt: { $lt: cursor.createdAt } },
    { createdAt: cursor.createdAt, _id: { $lt: cursor.id } },
  ]
}
```

## Index gerekli

Pagination query'si index'lenmiş field'lara olmalı:
```typescript
UserSchema.index({ status: 1, createdAt: -1, _id: -1 });
```

Yoksa collection scan → slow.

## Anti-pattern'ler

### Limitsiz
```typescript
@Query() limit?: number;  // ❌ user '1000000' gönderir
```

### skip() deep
```typescript
// ❌ page 1000, pageSize 100 → skip(100000), çok yavaş
this.model.find().skip(pageSize * page).limit(pageSize);
```

### Count her request'te
```typescript
// ❌ büyük collection'da her list call'da countDocuments() — saniyeler
const total = await model.countDocuments();
```
Approximate count kullan (`estimatedDocumentCount()`) veya cache.

### Client-side pagination
```typescript
// ❌ tüm 10k user'ı çek, client seçsin
const all = await this.userModel.find().lean();
return all.slice(start, end);
```

## Aksiyon

1. Küçük dataset (<10k): **offset** OK
2. Büyük dataset veya feed: **cursor**
3. Max limit hardcode (100)
4. Index sort field'larına
5. Total count opsiyonel (pahalı)
6. Compound sort → compound cursor
