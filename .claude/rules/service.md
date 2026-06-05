---
globs: "src/**/*.service.ts,src/**/services/**"
severity: should
---

# Service Katmanı Kuralları

`src/**/*.service.ts` ve `src/**/services/**` dosyalarında aktif.

## MUST

- `@Injectable()` decorator var
- Constructor injection (new ile dependency yaratmak yasak)
- Logger inject edilmiş: `private readonly logger = new Logger(ClassName.name)`
- Async metod `Promise<T>` döner (imza tam)
- Typed exception kullanır (`NotFoundException`, `BadRequestException` vs.)
- Business logic BURADA — controller'a değil
- DB erişimi BURADA — controller'dan erişmez

## SHOULD

- Single Responsibility: bir service bir bounded context
- Pure method (side-effect'siz) ayrı bir utility'de
- Dış servis çağrısı retry+timeout wrapped (resilience skill)
- Transaction ile atomik yazma (multi-document)
- Cache layer (Redis) sık okunan veri için
- Metric counter (Prometheus) kritik metodlarda

## ASLA

- `console.*` kullanma (Logger inject et)
- Generic `Error` throw (typed kullan)
- Dependency'yi constructor dışında set et (injection bypass)
- Service'te HTTP cevabı dönüştürme (controller'ın işi)
- Service'te request/response tipine bağlılık (DTO → internal model → DTO)
- 100+ satırlık metod (split)
- Nested try/catch labirent (tek catch yeterli, rethrow gerekirse)

## Örnekler

### İyi
```typescript
import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';

import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    const existing = await this.userModel.findOne({ email: dto.email }).lean();
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const hash = await bcrypt.hash(dto.password, 12);
    const user = await this.userModel.create({
      email: dto.email,
      password: hash,
      name: dto.name,
    });

    this.logger.log(`User created: ${user.id}`);
    return user.toObject();
  }

  async findById(id: string): Promise<User> {
    const user = await this.userModel.findById(id).lean();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({ email }).lean();
  }
}
```

### Kötü
```typescript
export class UsersService {  // ❌ @Injectable yok

  private db;
  constructor() {
    this.db = new MongoClient(...);  // ❌ new ile — DI bypass
  }

  create(body) {                      // ❌ async değil, typed değil, DTO değil
    if (this.db.findOne(body.email)) throw new Error('exists');  // ❌ generic Error, await yok
    console.log('created');            // ❌ console
    return body;
  }
}
```

## Constructor injection tercih

NestJS DI property injection'ı da destekler ama constructor tercih:

```typescript
// İyi
constructor(
  @InjectModel(User.name) private readonly userModel: Model<User>,
  private readonly logger: Logger,
  private readonly config: ConfigService,
) {}

// Kaçın
@Inject('SOMETHING')
private readonly thing: SomeType;
```

Constructor injection test'te mock'lanması daha kolay.

## Transaction örneği

```typescript
async transferBalance(from: string, to: string, amount: number): Promise<void> {
  const session = await this.connection.startSession();
  try {
    await session.withTransaction(async () => {
      await this.userModel.updateOne(
        { _id: from, balance: { $gte: amount } },
        { $inc: { balance: -amount } },
        { session }
      );
      await this.userModel.updateOne(
        { _id: to },
        { $inc: { balance: amount } },
        { session }
      );
    });
  } finally {
    await session.endSession();
  }
}
```

## Cache pattern

```typescript
async getPopularPosts(): Promise<Post[]> {
  const cached = await this.cache.get('popular-posts');
  if (cached) return cached;

  const posts = await this.postModel.find().sort({ views: -1 }).limit(10).lean();
  await this.cache.set('popular-posts', posts, { ttl: 300 });
  return posts;
}
```

## Hook etkileşimi

- Missing await (`findOne()` return without await) → post-write-check uyarır
- `console.log` → uyarı + error-log
- Long function (>50 satır) → info level uyarı
