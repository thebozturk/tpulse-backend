---
name: mongodb-migrations
keywords: "migration, migrate-mongo, forward-only, schema change, backfill"
description: "Migration stratejisi — forward-only, idempotent, safe"
---

# Migrations

## Tool: migrate-mongo

```bash
pnpm add -D migrate-mongo
npx migrate-mongo init
```

`migrate-mongo-config.js`:
```javascript
module.exports = {
  mongodb: {
    url: process.env.DATABASE_URL,
    options: { useNewUrlParser: true, useUnifiedTopology: true },
  },
  migrationsDir: 'migrations',
  changelogCollectionName: 'migrations',
  migrationFileExtension: '.ts',
};
```

## Forward-only prensip

**Down migration YAZILIR ama çalıştırılmaz.**

Sebep: rollback = data loss çoğu zaman. "Field ekledim, sil" → eklediğim data gitti.

Production'da rollback = yeni bir forward migration (undo logic).

```typescript
export async function down(): Promise<void> {
  throw new Error('Forward-only. Rollback için yeni migration oluştur.');
}
```

## Idempotent yazım

Migration ikinci kez çalışsa bile bozulmamalı:

```typescript
// ❌ İkinci kez: tüm 'pending' olanlar 'active' değil 'active-2' olur
await db.collection('users').updateMany(
  {},
  { $set: { status: 'active' } }
);

// ✓ Koşullu
await db.collection('users').updateMany(
  { status: { $exists: false } },
  { $set: { status: 'active' } }
);
```

## Tipik pattern'ler

### 1. Field ekle (default ile)
```typescript
export async function up(db: Db): Promise<void> {
  await db.collection('users').updateMany(
    { emailVerified: { $exists: false } },
    { $set: { emailVerified: false } }
  );
}
```

### 2. Field rename
```typescript
export async function up(db: Db): Promise<void> {
  await db.collection('users').updateMany(
    { oldName: { $exists: true } },
    { $rename: { oldName: 'newName' } }
  );
}
```

### 3. Field format dönüştür
```typescript
export async function up(db: Db): Promise<void> {
  const cursor = db.collection('users').find({ phoneNumber: { $type: 'string' } });

  for await (const user of cursor) {
    const normalized = normalizePhone(user.phoneNumber);
    await db.collection('users').updateOne(
      { _id: user._id },
      { $set: { phoneNumber: normalized } }
    );
  }
}
```

### 4. Index oluştur
```typescript
export async function up(db: Db): Promise<void> {
  await db.collection('orders').createIndex(
    { userId: 1, createdAt: -1 },
    { name: 'orders_user_created', background: true },
  );
}
```

`background: true` — production'da lock'suz.

### 5. Collection rename
```typescript
export async function up(db: Db): Promise<void> {
  await db.collection('old_name').rename('new_name');
}
```

### 6. Big data backfill (batch)
```typescript
export async function up(db: Db): Promise<void> {
  const cursor = db.collection('orders').find({ processed: { $exists: false } });
  const BATCH = 1000;
  let batch: any[] = [];

  for await (const doc of cursor) {
    batch.push({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: { processed: false } },
      },
    });

    if (batch.length >= BATCH) {
      await db.collection('orders').bulkWrite(batch);
      batch = [];
    }
  }
  if (batch.length) await db.collection('orders').bulkWrite(batch);
}
```

Memory-safe, production'da tail latency minimum.

## Expand-contract pattern (breaking schema change)

Field'ın tipini değiştirmek → tek adımda yapma:

### Faz 1: Expand (yeni field ekle)
```typescript
// Migration 1
await db.collection('users').updateMany(
  { birthDate: { $exists: true }, birthDateV2: { $exists: false } },
  [
    { $set: { birthDateV2: { $toDate: '$birthDate' } } },  // string → Date
  ]
);
```

Kod hem `birthDate` hem `birthDateV2`'yi yazar/okur.

### Faz 2: Migrate

Tüm eski data yeni field'a. Yeni yazımlar ikisine de.

### Faz 3: Contract (eski field sil)
```typescript
// Migration 2 (önceki deploy sonrası)
await db.collection('users').updateMany(
  {},
  { $unset: { birthDate: '' } }
);
```

Bu 3 adımlı süreç downtime-free.

## Naming

```
migrations/
  20260415143022-initial-schema.ts
  20260418091530-add-user-status.ts
  20260421104530-backfill-email-verified.ts
```

Timestamp prefix — sıra garantisi. ISO benzeri: `YYYYMMDDHHMMSS`.

## Çalıştırma

```bash
# Status
npx migrate-mongo status

# Up (pending hepsini)
npx migrate-mongo up

# Up belirli sayı
npx migrate-mongo up -f <specific-file>

# Status: APPLIED / PENDING
```

Production deploy'da **pipeline'a dahil**:
```yaml
# CI/CD
- name: Run migrations
  run: npx migrate-mongo up
```

## Güvenlik

### Her migration öncesi backup

```bash
mongodump --uri=$DATABASE_URL --out=backup-$(date +%Y%m%d-%H%M%S)
```

Otomatik cron + S3 upload.

### Staging'de test

Migration production'a gitmeden önce staging'de:
1. Production-like data snapshot
2. Migration çalıştır
3. Testler yeşil
4. Performance etkisi kabul edilebilir

### Büyük migration window

Large collection'da migration saatler sürebilir. Peak hours'ta başlatma.

## Anti-pattern'ler

### Down migration gerçek yazılmış
```typescript
export async function down(db: Db): Promise<void> {
  await db.collection('users').updateMany({}, { $unset: { status: '' } });
  // Data loss!
}
```

### Idempotent olmayan
```typescript
export async function up(db: Db): Promise<void> {
  await db.collection('users').updateMany({}, { $inc: { balance: 100 } });
  // İkinci kez: herkes +200 alır
}
```

### Schema change + data transform aynı migration
```typescript
// ❌ Field ekle + mevcut data dönüştür — fail olursa partial state
// ✓ İki ayrı migration:
//   1. Field ekle (optional, default)
//   2. Mevcut data backfill
//   3. Field zorunlu yap
```

### Uygulama + migration aynı anda deploy
Uygulama yeni schema bekliyor ama migration henüz çalışmadı → 500'ler.

Doğru sıra:
1. Expand migration (additive, backward-compat)
2. Uygulama deploy
3. Migrate data
4. Contract migration (old field sil)

## Aksiyon

1. `migrate-mongo` tool
2. Forward-only, `down()` throw
3. Idempotent logic
4. Batch ile büyük data backfill
5. Breaking change → expand-contract
6. Her migration öncesi backup
7. Staging'de test, sonra prod
8. CI/CD pipeline'ına dahil
