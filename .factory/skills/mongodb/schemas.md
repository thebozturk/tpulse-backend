---
name: mongodb-schemas
keywords: "schema, mongoose, @Prop, Schema, document, embedded, reference"
description: "Mongoose schema tasarımı — field, embed vs reference"
---

# Schemas

## Temel yapı

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true, versionKey: false })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true, select: false })
  password: string;

  @Prop({ enum: ['active', 'banned'], default: 'active' })
  status: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
```

## Schema options

```typescript
@Schema({
  timestamps: true,       // createdAt, updatedAt otomatik
  versionKey: false,      // __v field'i kapat
  collection: 'users',    // explicit collection adı
  strict: true,           // tanımsız field reddedilir (default true)
  id: true,               // virtual id field (= _id.toString())
  toJSON: {
    virtuals: true,
    transform: (doc, ret) => {
      delete ret._id;     // _id'yi id'ye dönüştür
      delete ret.password; // paranoia (select:false zaten var)
      return ret;
    },
  },
})
```

## Prop options

```typescript
@Prop({
  required: true,
  unique: true,           // → auto index
  index: true,            // manual index
  default: 'pending',
  enum: ['a', 'b'],
  min: 0,                 // number için
  max: 100,
  minlength: 3,           // string için
  maxlength: 100,
  trim: true,
  lowercase: true,
  uppercase: true,
  match: /^[A-Z]+$/,      // regex
  select: false,          // default dışla
  ref: 'Team',            // FK referansı
  immutable: true,        // yaratıldıktan sonra değişmez
})
```

## Embed vs Reference

### Embed (sub-document)

```typescript
@Schema()
class Address {
  @Prop() street: string;
  @Prop() city: string;
  @Prop() zip: string;
}

@Schema()
export class User {
  @Prop({ type: Address })
  address: Address;

  @Prop({ type: [Address] })  // array of embed
  addresses: Address[];
}
```

**Ne zaman embed:**
- Child sadece parent ile anlamlı
- Her zaman birlikte okunur
- Child ayrı query'lenmez
- Kardinalite düşük (birkaç adet)

**Örnek:** User.addresses, Order.items, Post.comments (az sayıdaysa)

### Reference (ObjectId + ref)

```typescript
@Schema()
export class Order {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;
}
```

**Ne zaman reference:**
- Child ayrı query'lenir
- Kardinalite yüksek (1000+)
- Child başka parent'lardan paylaşılır
- Parent sık güncellenir (embed ise her update parent'ı büyütür)

**Örnek:** Order.userId (user ayrı), Post.authorId, Team.members[] (çok sayıda)

### Karar matrisi

| Durum | Embed | Reference |
|-------|-------|-----------|
| 1:few (1-10) | ✓ | ✗ |
| 1:many (100+) | ✗ | ✓ |
| 1:*many* (1M+) | ✗ | ✓ (reverse ref) |
| Ayrı sorgulanıyor | ✗ | ✓ |
| Atomic update | ✓ | ✗ |
| Parent size limit (16MB) aşıyor | ✗ | ✓ |

## Reverse reference (1-to-millions)

Team.users[] olmasın — her user'da `teamId`:
```typescript
@Schema()
export class User {
  @Prop({ type: Types.ObjectId, ref: 'Team', index: true })
  teamId: Types.ObjectId;
}

// Team'in user'larını çekmek için:
// this.userModel.find({ teamId: team._id })
```

Team document 16MB limit'e takılmaz.

## Discriminator (polymorphism)

Farklı tipte doküman'lar aynı collection'da:

```typescript
@Schema({ discriminatorKey: 'type' })
class Event {
  @Prop() type: string;
  @Prop() createdAt: Date;
}

@Schema()
class LoginEvent extends Event {
  @Prop() ip: string;
  @Prop() userAgent: string;
}

@Schema()
class OrderEvent extends Event {
  @Prop() orderId: Types.ObjectId;
  @Prop() amount: number;
}

// Module'de
MongooseModule.forFeatureAsync([{
  name: Event.name,
  useFactory: () => {
    const schema = EventSchema;
    schema.discriminator('LoginEvent', LoginEventSchema);
    schema.discriminator('OrderEvent', OrderEventSchema);
    return schema;
  },
}])
```

Tek collection, type-aware queries.

## Virtual

Hesaplanmış field (DB'ye yazılmaz):

```typescript
UserSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Kullanım
const user = await userModel.findById(id);
user.fullName;  // computed

// JSON'a dahil olması için
@Schema({ toJSON: { virtuals: true } })
```

## Virtual populate (reverse join)

```typescript
UserSchema.virtual('orders', {
  ref: 'Order',
  localField: '_id',
  foreignField: 'userId',
});

// Kullanım
await userModel.findById(id).populate('orders');
```

## Pre/post hooks

```typescript
UserSchema.pre<UserDocument>('save', async function () {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 12);
  }
});

UserSchema.post('save', function (doc) {
  logger.log(`User saved: ${doc._id}`);
});
```

**Dikkat:** Hook'larda business logic yığma — service'e ait.

## Anti-pattern'ler

- `Mixed` type (`any` equivalent, type safety yok)
- Embed with 1000+ items (16MB limit)
- Reference with 1-to-few (gereksiz populate)
- Hook'ta external API call
- Schema'da method (`this.sendEmail()`)
- `_id` olarak custom string

## Aksiyon

1. Schema minimum bağımlılıkla
2. Embed vs reference: kardinalite + access pattern
3. Index: unique, frequent query, sort
4. Hassas field: `select: false`
5. Virtual computed field için
6. Hook sadece şekil dönüşümü (hash, slug)
