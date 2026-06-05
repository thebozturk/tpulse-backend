---
name: nestjs-modules
keywords: "module, feature module, imports, exports, providers, controllers, nestjs"
description: "NestJS module organizasyonu ve bağımlılık yönetimi"
---

> **Stack-aware:** Bu skill MongoDB/Mongoose örnekleri veriyor. Prisma+PostgreSQL projelerinde aynı pattern paralel olarak `prisma/` ve `postgres/` skill'lerinde anlatılır. Önce `.factory/memory/conventions.json` → `stack.orm` field'ına bak.


# NestJS Modules

## Ne zaman kullan

Her yeni feature için bir module. Feature-based organizasyon (layered değil).

```
src/modules/
├── users/          # feature module
│   ├── users.module.ts
│   ├── users.controller.ts
│   ├── users.service.ts
│   ├── dto/
│   └── schemas/
├── auth/
└── profile/
```

## Module nedir

Module: bağımlılık organizasyon birimi. DI container bunu kullanır, neyin neyi enjekte edebildiğini çözer.

## Standart module yapısı

```typescript
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User, UserSchema } from './schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],  // Başka modüllerden erişim için
})
export class UsersModule {}
```

### Her alanın anlamı

| Alan | Ne koyulur |
|------|-----------|
| `imports` | Bu modül'ün ihtiyaç duyduğu diğer modüller |
| `controllers` | HTTP route handler'ları |
| `providers` | Service'ler, repository'ler, custom factory'ler |
| `exports` | Dışarıya açılan provider'lar |

### İmport edilmezse

Başka bir modül `UsersService`'i enjekte edemez. `imports: [UsersModule]` ve `exports: [UsersService]` gerekli.

## Dynamic module (config ile)

```typescript
@Module({})
export class DatabaseModule {
  static forRoot(options: DbOptions): DynamicModule {
    return {
      module: DatabaseModule,
      providers: [
        { provide: 'DB_OPTIONS', useValue: options },
        DatabaseService,
      ],
      exports: [DatabaseService],
    };
  }
}

// Kullanım
@Module({
  imports: [
    DatabaseModule.forRoot({ host: 'localhost', port: 27017 }),
  ],
})
```

## Async module (config service bağımlılığı)

```typescript
static forRootAsync(options: DbOptionsAsync): DynamicModule {
  return {
    module: DatabaseModule,
    imports: options.imports || [],
    providers: [
      {
        provide: 'DB_OPTIONS',
        useFactory: options.useFactory,
        inject: options.inject || [],
      },
      DatabaseService,
    ],
    exports: [DatabaseService],
  };
}

// Kullanım
MongooseModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    uri: config.get('DATABASE_URL'),
  }),
});
```

## Global module

`@Global()` ile her module'de otomatik kullanılabilir:

```typescript
@Global()
@Module({
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}
```

**Dikkat:** Overuse etme — implicit dependencies yaratır, test zorlaşır. Sadece gerçekten her yerde lazım olanlar için.

## app.module.ts — root

```typescript
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validationSchema: envSchema }),
    MongooseModule.forRootAsync({ ... }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),

    // Feature modules
    AuthModule,
    UsersModule,
    ProfileModule,
  ],
})
export class AppModule {}
```

## Circular dependency

A → B → A = circular. NestJS algılar ama uyarı verir. Çözüm:

1. **Refactor:** ortak logic'i C modülüne çıkar, ikisi de C'yi import eder.
2. **`forwardRef`:** kaçınılmazsa son çare:
   ```typescript
   @Module({ imports: [forwardRef(() => OtherModule)] })
   ```

## Anti-pattern'ler

### Tek büyük module
```typescript
@Module({
  imports: [...],
  controllers: [UsersController, OrdersController, PaymentsController, ...],
  providers: [UsersService, OrdersService, ...],
})
export class AppModule {}
```
Her şey root'ta → feature bağımsızlığı yok, test zor, merge conflict fazla.

### Gereksiz dynamic module
Static imports yeterli olduğunda `forRoot()` yazma. Sadece config değişkenliği gerekiyorsa.

### Export etmeden paylaşmaya çalışma
`exports: [UsersService]` yoksa başka modül enjekte edemez.

## Aksiyon

Yeni feature module oluştururken:
1. `src/modules/<feature>/` klasörü aç
2. `<feature>.module.ts` — standart yapı
3. Schema'lar için `MongooseModule.forFeature`
4. Başka modüller kullanacaksa service'i `exports`'a ekle
5. `app.module.ts`'in `imports`'una yeni modülü ekle
6. Test: `pnpm tsc --noEmit` ile DI chain geçerli mi doğrula
