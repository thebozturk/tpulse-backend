---
globs: "src/**/*.schema.ts,src/**/schemas/**"
severity: must
---

# MongoDB Schema Kuralları

`src/**/*.schema.ts` ve `src/**/schemas/**` dosyalarında aktif.

## MUST

- `@Schema({ timestamps: true, versionKey: false })` default
- Hassas field (`password`, `refreshToken`, `mfaSecret`) → `@Prop({ select: false })`
- Unique field → `@Prop({ unique: true, index: true })`
- Enum field → `@Prop({ enum: [...] })` + `default: value`
- Referans → `@Prop({ type: Types.ObjectId, ref: 'OtherEntity', index: true })`
- Sık query'lenen field → `index: true`
- Document type export: `export type XDocument = X & Document`
- Schema factory: `export const XSchema = SchemaFactory.createForClass(X)`

## SHOULD

- Compound index sık kombinasyon için (`.index({ userId: 1, createdAt: -1 })`)
- String field `maxlength` taşır (DoS önlemi — çok uzun input)
- String field `trim: true` (trailing whitespace)
- Email `lowercase: true` + `trim: true`

## ASLA

- `Mixed` type (`any` equivalent — type safety yok)
- `password` / `token` field'da `select: false` OLMAMAK (security-gate BLOCK eder)
- Schema'da business logic method (service'e ait)
- External API çağrısı schema virtual'da
- Nested schema 3+ seviye derinlikte (aggregation'a geç)
- `_id` olarak custom string (`Types.ObjectId` kullan)

## Örnekler

### İyi
```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true, versionKey: false, collection: 'users' })
export class User {
  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    maxlength: 255,
    index: true,
  })
  email: string;

  @Prop({ required: true, select: false, maxlength: 72 })
  password: string;

  @Prop({ required: true, trim: true, maxlength: 100 })
  name: string;

  @Prop({
    enum: ['active', 'banned', 'pending'],
    default: 'pending',
    index: true,
  })
  status: string;

  @Prop({ type: Types.ObjectId, ref: 'Team', index: true })
  teamId?: Types.ObjectId;

  @Prop({ select: false })
  refreshTokenHash?: string;

  @Prop({ type: Date })
  lastLoginAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Compound index
UserSchema.index({ teamId: 1, status: 1, createdAt: -1 });

// Text search (opsiyonel)
UserSchema.index({ name: 'text', email: 'text' });
```

### Kötü
```typescript
@Schema()  // ❌ timestamps: true yok
export class User {
  email: string;                              // ❌ @Prop yok (kaydedilmez)

  @Prop()                                      // ❌ required/unique/index yok
  password: string;                            // ❌ select: false yok — LEAK

  @Prop({ type: Object })                     // ❌ Mixed — type safety yok
  settings: any;

  @Prop()
  status: string;                             // ❌ enum yok — typo'ya açık

  // ❌ Business logic method
  async resetPassword() {
    this.password = await bcrypt.hash('new', 10);
  }
}
```

## TTL index (otomatik silme)

Session, email verification, temp token için:

```typescript
@Prop({ default: () => new Date(Date.now() + 60 * 60 * 1000) }) // 1 saat
expiresAt: Date;

SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// → MongoDB expiresAt geçince otomatik sil
```

## Partial index (koşullu)

Sadece belirli durumda index:
```typescript
UserSchema.index(
  { lastActive: -1 },
  { partialFilterExpression: { status: 'active' } }
);
// Sadece status='active' kullanıcılarda index — storage tasarrufu
```

## Post-write hook etkileşimi

- Password/token field'da `select: false` yoksa → security-gate **BLOCK**
- `Mixed` type → warning (post-write-check)
- Index olmayan `unique: true` → warning (compound index önerilir)
