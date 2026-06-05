# /migrate — Database Migration

$ARGUMENTS: Komut. Seçenekler: `create <ad>`, `up`, `down`, `status`. Default: `status`.

## Amaç

MongoDB migration oluştur, çalıştır, durumunu gör. Forward-only prensibi — down migration YAZILIR ama production'da çalıştırılmaz.

## Protocol

1. **KOMUT BELİRLE**
2. **ÇALIŞTIR**
3. **RAPORLA**

## Context Bütçesi: Max 10k token

---

## Alt komutlar

### `/migrate status` (default)

Mevcut migration durumu:
```bash
pnpm migrate:status
# veya
npx migrate-mongo status
```

Çıktı:
```
Filename                              Applied At
20260415-initial-schema.ts            2026-04-15 14:30:00
20260418-add-user-status.ts           2026-04-18 09:15:00
20260421-add-avatar-field.ts          PENDING
```

### `/migrate create <ad>`

Yeni migration dosyası oluştur:
```bash
pnpm migrate:create <ad>
# Output: migrations/20260421-<ad>.ts
```

Dosya template'i:
```typescript
import { Db } from 'mongodb';

export async function up(db: Db): Promise<void> {
  // Forward migration logic
  // Örn: field ekle, index oluştur, data dönüştür

  await db.collection('users').updateMany(
    { status: { $exists: false } },
    { $set: { status: 'active' } }
  );
}

export async function down(db: Db): Promise<void> {
  throw new Error(
    'Forward-only migration. Rollback için yeni bir migration oluştur.'
  );
}
```

Kullanıcıya:
```
Migration dosyası oluşturuldu:
  migrations/20260421-<ad>.ts

Şimdi:
1. Dosyayı edit et, up() içine logic yaz
2. /migrate up — çalıştır
```

### `/migrate up`

Pending migration'ları uygula:
```bash
pnpm migrate:up
```

**ÖNCE:**
- DB'nin backup'ı var mı kontrol et
- Staging'de test edildi mi

**SONRA:**
- Rapor: kaç migration uygulandı, süre
- Uygulama yeniden başlat gerekiyorsa belirt

### `/migrate down`

**GENELDE KULLANMA.** Forward-only prensip:

```
⚠️  Down migration production'da kullanılmaz.

Sebep: Çoğu down migration data loss içerir. Bir field sil → data gitti.
       Production'da "rollback" yerine yeni bir forward migration yazılır.

Staging/dev'de test amaçlı kullanmak için:
  pnpm migrate:down
```

---

## Yaygın migration pattern'ları

### 1. Field ekle (default value ile)
```typescript
export async function up(db: Db): Promise<void> {
  await db.collection('users').updateMany(
    { status: { $exists: false } },
    { $set: { status: 'active' } }
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

### 3. Index oluştur
```typescript
export async function up(db: Db): Promise<void> {
  await db.collection('orders').createIndex(
    { userId: 1, createdAt: -1 },
    { name: 'orders_user_created' }
  );
}
```

### 4. Büyük veri dönüştürme (batch)
```typescript
export async function up(db: Db): Promise<void> {
  const cursor = db.collection('users').find({ emailVerified: { $exists: false } });
  const BATCH_SIZE = 1000;
  let batch = [];

  for await (const doc of cursor) {
    batch.push({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: { emailVerified: false } }
      }
    });

    if (batch.length >= BATCH_SIZE) {
      await db.collection('users').bulkWrite(batch);
      batch = [];
    }
  }
  if (batch.length) {
    await db.collection('users').bulkWrite(batch);
  }
}
```

### 5. Collection rename
```typescript
export async function up(db: Db): Promise<void> {
  await db.collection('oldName').rename('newName');
}
```

---

## YAPMA

- **Production'da `migrate:down` çalıştırma.** Data loss.
- **Test etmeden production'a deploy.** Her migration staging'de denenmiş olmalı.
- **Backup olmadan migrate:up.** Her migration öncesi snapshot.
- **Schema değişikliği + data dönüşümü aynı migration'da.** Ayrı commit'ler:
  1. Önce schema migration (field opsiyonel)
  2. Data backfill migration
  3. Schema'yı zorunlu yap
- **Migration'ı silme (uygulandıktan sonra).** History bozulur.
- **Aynı ismini kullanma.** Timestamp prefix zorunlu.
