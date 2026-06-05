---
name: mongodb-indexes
keywords: "index, compound, unique, sparse, text, TTL, ESR, performance"
description: "Index stratejisi ve performance"
---

# Indexes

## Neden gerekli

İndexsiz query = collection scan = N doküman için O(N). 1M doküman'da 5+ saniye.
İndexli query = B-tree lookup = O(log N). 1M'de <10ms.

## Temel index çeşitleri

### Single field
```typescript
UserSchema.index({ email: 1 });
// Ascending
```

### Compound
```typescript
// Sıra ÇOK önemli. ESR rule (aşağıda)
UserSchema.index({ teamId: 1, createdAt: -1 });
```

### Unique
```typescript
UserSchema.index({ email: 1 }, { unique: true });
// Aynı email ile duplicate insert → E11000 error
```

### Sparse

Field yoksa index'e almaz:
```typescript
UserSchema.index({ phoneNumber: 1 }, { sparse: true });
// phoneNumber undefined olan dokümanlar index'te yok — storage tasarrufu
```

### Partial

Filter'a uyan dokümanları index'ler:
```typescript
UserSchema.index(
  { email: 1 },
  { partialFilterExpression: { status: 'active' } }
);
// Sadece active user'lar index'te
```

### TTL (auto-expire)

```typescript
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// expiresAt < now → auto delete (MongoDB 60s'de bir tarar)
```

### Text (full-text search)

```typescript
PostSchema.index({ title: 'text', content: 'text' });

// Query
model.find({ $text: { $search: 'javascript' } });
```

Bir collection'da bir text index — birden fazla field'i tek index'te topla.

### Wildcard

```typescript
UserSchema.index({ 'metadata.$**': 1 });
// metadata.* altındaki her field index
```

Kullan: dinamik field'lı documents (schema-less).

## ESR Rule (compound index field order)

**E**quality → **S**ort → **R**ange

```typescript
// Query: {status:'active'} sort:{createdAt:-1} filter:{age:{$gt:18}}
UserSchema.index({ status: 1, createdAt: -1, age: 1 });
//            E            S                R
```

Sıra yanlışsa index yarım kullanılır.

## Prefix kuralı

Compound index `{a:1, b:1, c:1}`:
- Query `{a:1}` → kullanır (prefix)
- Query `{a:1, b:1}` → kullanır
- Query `{a:1, c:1}` → **a için kullanır, c için değil**
- Query `{b:1, c:1}` → **kullanamaz** (a yok)

İki compound index ihtiyacı olabilir:
```typescript
UserSchema.index({ a: 1, b: 1, c: 1 });
UserSchema.index({ b: 1, c: 1 });  // b ile başlayan query'ler için
```

## explain() ile analiz

```typescript
await userModel.find({ status: 'active' }).sort({ createdAt: -1 }).explain('executionStats');
```

Check:
- `executionStats.totalDocsExamined` — kaç doküman tarandı
- `executionStats.executionTimeMillis` — süre
- `winningPlan.stage` — COLLSCAN ise index yok → problem

**Hedef:** `totalDocsExamined / nReturned ≈ 1` (sadece gereken okundu).

## Hot indexes

Başlangıçta her collection için:

```typescript
// User
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ teamId: 1, createdAt: -1 });
UserSchema.index({ status: 1 }, { partialFilterExpression: { status: 'active' } });

// Order
OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });

// Session
SessionSchema.index({ userId: 1 });
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// AuditLog
AuditLogSchema.index({ userId: 1, createdAt: -1 });
AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 }); // 90 gün
```

## Anti-pattern'ler

### Index overkill
```typescript
// ❌ 15 index — her write yavaşlar
UserSchema.index({ email: 1 });
UserSchema.index({ name: 1 });
UserSchema.index({ phone: 1 });
UserSchema.index({ address: 1 });
// ... 11 daha
```
Her index write cost'u ekler. Sadece **gerçekten** query'lenen için.

### ESR ihlali
```typescript
// ❌ Range field önde
UserSchema.index({ age: 1, status: 1 });  // status range gibi kullanılır
```

### Unique olmayan "unique"
```typescript
@Prop({ unique: true })
username?: string;  // optional
```
null + null → duplicate olarak sayılmaz (MongoDB bug-ish). `sparse: true` ekle:
```typescript
UserSchema.index({ username: 1 }, { unique: true, sparse: true });
```

### Text + regex karışık
```typescript
// Bir collection'da birden fazla text index → error
PostSchema.index({ title: 'text' });
PostSchema.index({ content: 'text' });  // error

// İYİ — birleştir
PostSchema.index({ title: 'text', content: 'text' });
```

### Uzun compound index key
MongoDB index key size limit 1024 byte. Çok alan + string concat → hata.

## Aksiyon

1. Her schema için: unique + frequent query + sort → index
2. Compound index ESR rule'uyla
3. Hassas yaşam döngüsü: TTL
4. Optional unique: `sparse: true`
5. Partial index koşullu
6. `explain('executionStats')` ile doğrula
7. Index sayısı makul (genelde <10 per collection)
