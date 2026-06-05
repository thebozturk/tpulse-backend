# /db — Database operations

Argument: `<subcommand>` — init | migrate | schema | seed | reset

Context bütçesi: 12k token

## Subcommands

### `/db init`
Yeni bir DB stack kur. İlk soruda Prisma+Postgres mı Mongoose+MongoDB mi sor:

```
1. ask: "Hangi stack? Prisma+PostgreSQL | Mongoose+MongoDB"
2. Prisma seçilirse:
   - Read .factory/skills/prisma/setup.md
   - Read .factory/skills/postgres/connection-pooling.md
   - pnpm add @prisma/client && pnpm add -D prisma
   - npx prisma init
   - PrismaService + @Global() PrismaModule oluştur
   - .env DATABASE_URL placeholder
   - docker-compose'a postgres servisi ekle
   - .factory/memory/conventions.json'a {"orm": "prisma", "db": "postgresql"} yaz
3. Mongoose seçilirse:
   - Read .factory/skills/mongodb/INDEX.md
   - Mevcut Mongoose pattern'i (zaten kurulu)
   - .factory/memory/conventions.json'a {"orm": "mongoose", "db": "mongodb"} yaz
```

### `/db migrate <name>`
Migration oluştur ve apply et.

```
1. conventions.json oku → orm field
2. Prisma:
   - schema.prisma değişikliği bekleniyor (user düzenlemiş olmalı)
   - npx prisma migrate dev --name <name>
   - prisma generate (otomatik)
   - Test: npx prisma validate
3. Mongoose:
   - migrate-mongo veya manuel script
   - .factory/skills/mongodb/migrations.md oku
   - Migration script template uygula
```

Production deploy uyarısı: `npx prisma migrate deploy` deployment'ta çalışsın, `dev` LOCAL only.

### `/db schema <model>`
Yeni model ekle.

```
1. conventions.json → orm
2. Prisma:
   - Read .factory/skills/prisma/schema.md
   - Read .factory/skills/prisma/relations.md
   - Soru: relation var mı? (1:1 / 1:n / n:m)
   - schema.prisma'ya model ekle (PascalCase, naming convention)
   - @@map snake_case
   - FK için @@index ZORUNLU
   - Sonra /db migrate <add_x_model> öner
3. Mongoose:
   - Schema interface + decorator pattern
   - Module'a register
```

### `/db seed`
Seed script çalıştır veya oluştur.

```
1. conventions.json → orm
2. prisma/seed.ts var mı?
   - Yoksa: Read .factory/skills/prisma/seeding.md → template
   - Varsa: npx prisma db seed
3. Production guard: NODE_ENV check ZORUNLU
4. faker.seed(<deterministic>) önerisi
```

### `/db reset`
**TEHLIKELI — production'da ASLA çalıştırılmaz.**

```
1. NODE_ENV check
2. Production'da → BLOCK + uyarı
3. Local: npx prisma migrate reset --force
4. Seed otomatik tetiklenir
```

User'a 3 kere onay sor (typo "RESET" yazsın).

## Output format

Her subcommand sonunda:
- Ne yapıldı (yapılan değişiklikler özeti)
- Sonraki adım önerisi (örn. "/db schema User çalıştır")
- Etkilenen dosyalar listesi

## Stack detection

Komut başında her zaman:
1. `.factory/memory/conventions.json` oku
2. Field yoksa veya ilk init ise → `/onboard` öner
3. Field varsa o stack'i kullan

## YAPMA

- conventions.json okuduğunda yanlış stack ile devam etme
- Prisma + Mongoose aynı projede karıştırma (hibrit advanced — manual setup)
- Production'da `migrate dev`, `db push`, `migrate reset` ÇALIŞTIRMA
- schema.prisma'yı arbitrary edit etme — model add command'ı kullan
- DATABASE_URL'i .env'e hardcode commit etme (`.env.example` placeholder)

## Örnek session

```
User: /db init
Claude: Hangi stack?
  1. Prisma + PostgreSQL (modern, type-safe)
  2. Mongoose + MongoDB (mevcut)
User: 1
Claude: [Prisma kurulumu, PrismaService, docker-compose, conventions.json yazılır]
       Sonraki: /db schema User ile ilk model'i ekle.

User: /db schema User
Claude: Read schema.md + relations.md
       Relation var mı?
       1. Yok (standalone)
       2. 1:n (belongs to / has many)
       3. n:m
User: 2 - User has many Posts
Claude: [model User + Post + relation, @@index, @@map yazılır]
       Sonraki: /db migrate add_user_post

User: /db migrate add_user_post
Claude: [npx prisma migrate dev --name add_user_post; generate]
       Migration başarılı, 2 model + 2 index oluşturuldu.
```
