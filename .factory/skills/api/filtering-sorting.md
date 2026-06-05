---
name: api-filtering-sorting
keywords: "filter, sort, query, where, order, search"
description: "Query parameter ile filter ve sort"
---

# Filtering & Sorting

## Filter pattern'leri

### Flat
```
GET /users?status=active&role=admin
```
Basit, ama complex query için sınırlı.

### Bracket notation
```
GET /users?filter[status]=active&filter[age][gte]=18
```
Operator destekler ama URL uzar.

### RHS colon (RHS Brackets)
```
GET /users?status=active&age=gte:18&email=like:@acme.com
```
Kompakt, operator inline.

**Öneri:** Flat + operator gerekirse bracket.

## Whitelist yaklaşımı

User input'unu doğrudan DB query'e **ASLA** geçirme:

```typescript
// ❌ KÖTÜ — SQL/NoSQL injection
const query = req.query;  // { "$where": "..." } olabilir
await this.userModel.find(query);

// ✓ İYİ — whitelist
const allowedFilters = ['status', 'role', 'teamId'];
const safeFilter = {};
for (const key of allowedFilters) {
  if (req.query[key]) safeFilter[key] = req.query[key];
}
await this.userModel.find(safeFilter);
```

## DTO ile validate

```typescript
export class UserFilterDto extends PaginationDto {
  @IsOptional() @IsEnum(['active', 'banned', 'pending'])
  status?: string;

  @IsOptional() @IsEnum(['user', 'admin'])
  role?: string;

  @IsOptional() @IsString() @MaxLength(50)
  search?: string;

  @IsOptional() @IsMongoId()
  teamId?: string;

  @IsOptional() @IsString() @Matches(/^-?(createdAt|name|email)$/)
  sort?: string = '-createdAt';
}
```

Type-safe ve whitelist built-in.

## Sort syntax

Minus prefix ile desc:
```
?sort=createdAt     → asc
?sort=-createdAt    → desc
?sort=-status,name  → multi (status desc, then name asc)
```

Parse:
```typescript
function parseSort(s: string): Record<string, 1 | -1> {
  const result = {};
  for (const part of s.split(',')) {
    if (part.startsWith('-')) result[part.substring(1)] = -1;
    else result[part] = 1;
  }
  return result;
}

// Usage
const sortObj = parseSort(dto.sort || '-createdAt');
await model.find(filter).sort(sortObj);
```

## Full-text search

MongoDB text index:
```typescript
UserSchema.index({ name: 'text', email: 'text' });

// Query
await model.find({ $text: { $search: 'alice' } });
```

Alternatif: regex (case-insensitive):
```typescript
const escaped = escape(search);  // regex escape
await model.find({ name: { $regex: escaped, $options: 'i' } });
```

Büyük dataset'te **Atlas Search** veya **Elasticsearch** gerekebilir.

## Regex escape (injection önlemi)

```typescript
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Kullanım
const safe = escapeRegex(userInput);
model.find({ name: { $regex: safe, $options: 'i' } });
```

**User input direkt `$regex`'e GİTMEZ** (NoSQL injection + ReDoS).

## Compound index requirement

Filter + sort combine → compound index:

```typescript
// Query: filter by status, sort by createdAt desc
.find({ status: 'active' }).sort({ createdAt: -1 })

// Index
UserSchema.index({ status: 1, createdAt: -1 });
```

ESR rule: **E**quality → **S**ort → **R**ange (field sırası).

## Anti-pattern'ler

### Direct query pass-through
```typescript
await model.find(req.query);  // ❌ injection
```

### Sort whitelist yok
```typescript
.sort(req.query.sort as any)  // ❌ "$where" gelir
```

### Regex user input
```typescript
.find({ name: { $regex: req.query.q } })  // ❌ ReDoS
```

### SQL-like filters (Mongo için)
```
?where=name%3D%27Alice%27  // ❌ KV value to raw Mongo filter
```

## Aksiyon

- Filter field'ları DTO'da whitelist
- Sort field'ları regex ile whitelist
- Search input escape (ReDoS önlemi)
- Filter+sort combine için compound index
- Full-text için text index veya external search
