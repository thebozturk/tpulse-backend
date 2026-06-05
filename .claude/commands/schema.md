# /schema — MongoDB Schema Ekleme/Güncelleme

$ARGUMENTS: Schema adı veya modül. Örn: `user`, `order`, `audit-log`.

## Amaç

Mongoose schema oluştur (veya güncelle). Index'leri, ilişkileri, validation'ı doğru kur. Migration gerekiyorsa önerir.

## Protocol

1. **ANLA** — Yeni mi, güncelleme mi
2. **ALAN TANIMLA** — Field'lar + tipleri + kısıtlamalar
3. **INDEX PLANI** — Hangi field'lar query'lenir
4. **YAZ** — Schema dosyası
5. **MIGRATION** — Gerekirse (existing data varsa)
6. **COMMIT**

## Context Bütçesi: Max 12k token

---

## AŞAMA 1: ANLA

Yeni schema mı, mevcut mu?
- **Yeni:** `src/modules/$ARGUMENTS/schemas/$ARGUMENTS.schema.ts` yoksa
- **Güncelleme:** varsa field ekle/çıkar

Kullanıcıya sor:

```
$ARGUMENTS schema detayı:

1. Field'lar (isim + tip + kısıtlama):
   name: string (required, max 100)
   email: string (required, unique)
   age: number (optional, min 0 max 150)

2. Başka schema'larla ilişki var mı?
   - Belongs to? (örn. order.userId → User)
   - Has many? (örn. user.orders[])

3. Sık query yapılacak field'lar?
   (Bunlar index olacak)
```

---

## AŞAMA 2: ALAN TANIMLA

### Field tipleri

| Mongoose | TypeScript | Kullanım |
|----------|------------|----------|
| String | string | metin |
| Number | number | sayı |
| Boolean | boolean | true/false |
| Date | Date | zaman |
| ObjectId | Types.ObjectId | FK referans |
| Array | T[] | liste |
| Mixed | any | esnek (kaçın) |

### Kısıtlamalar

```typescript
@Prop({
  required: true,
  trim: true,
  minlength: 3,
  maxlength: 100,
  lowercase: true,        // email için
  unique: true,
  index: true,
  default: 'pending',
  enum: ['pending', 'active', 'banned'],
  select: false,          // password/token için
})
```

### Hassas field (password, token, secret)

**ZORUNLU** `select: false`:
```typescript
@Prop({ required: true, select: false })
password: string;
```

Security-gate bunu kontrol eder. Yoksa BLOCK.

---

## AŞAMA 3: INDEX PLANI

Her schema için düşün:

- **Unique** — email, username, etc.
- **Compound** — sık birlikte query'lenen field'lar: `{ userId: 1, createdAt: -1 }`
- **Text** — full-text search gerekiyorsa
- **TTL** — expire olacak doküman için (session, tempToken)
- **Partial** — sadece belirli koşullarda index (örn. `{ status: 'active' }`)

```typescript
// Schema altında
<Pascal>Schema.index({ email: 1 }, { unique: true });
<Pascal>Schema.index({ userId: 1, createdAt: -1 });
<Pascal>Schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL
```

---

## AŞAMA 4: YAZ

`.factory/snippets/schema-template.ts`'den başla, uyarla.

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type <Pascal>Document = <Pascal> & Document;

@Schema({
  timestamps: true,      // createdAt, updatedAt otomatik
  versionKey: false,     // __v field'i kapat
  collection: '<snake>s', // opsiyonel, auto: PascalCase pluralize
})
export class <Pascal> {
  @Prop({ required: true, trim: true, maxlength: 100 })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, index: true })
  email: string;

  @Prop({ required: true, select: false })
  password: string;

  @Prop({ enum: ['active', 'banned'], default: 'active' })
  status: string;

  @Prop({ type: Types.ObjectId, ref: 'Team', index: true })
  teamId?: Types.ObjectId;
}

export const <Pascal>Schema = SchemaFactory.createForClass(<Pascal>);

// Compound index
<Pascal>Schema.index({ teamId: 1, createdAt: -1 });
```

Module'e register:
```typescript
// <feature>.module.ts
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: <Pascal>.name, schema: <Pascal>Schema }]),
  ],
})
```

---

## AŞAMA 5: MIGRATION (mevcut collection varsa)

**Yeni collection:** migration gerekmez, ilk kayıtta oluşur.

**Mevcut collection + field değişimi:** migration zorunlu.

### Forward-only prensip

Migration dosyaları **sadece forward** olmalı. Rollback için yeni bir migration yaz, `down()` üzerinden değil.

### Migration oluştur

```bash
pnpm migrate:create add-status-to-users
# migrations/20260421-add-status-to-users.ts dosyası oluşur
```

Örnek migration:
```typescript
export async function up(db: Db): Promise<void> {
  await db.collection('users').updateMany(
    { status: { $exists: false } },
    { $set: { status: 'active' } }
  );
}

export async function down(db: Db): Promise<void> {
  // Forward-only prensibi nedeniyle kullanılmaz
  throw new Error('Use forward migration instead of rollback');
}
```

Çalıştır:
```bash
pnpm migrate:up
```

---

## AŞAMA 6: COMMIT

```bash
git add src/modules/<feature>/schemas/ migrations/
git commit -m "feat(schema): add <schema> with index"
```

---

## YAPMA

- **`password`/`token` field için `select: false` unutma.** Security-gate BLOCK.
- **`Mixed` tipini kullanma.** Type safety kaybolur.
- **Index eklemeden query'le.** Slow query üretir.
- **Production'da down migration çalıştırma.** Forward-only.
- **Schema'ya business logic koyma.** O service'in işi. Schema sadece veri şekli.
- **`timestamps: false` default.** `timestamps: true` tercih (createdAt, updatedAt).
- **ObjectId yerine string kullanma.** Referans integrity kaybı.
