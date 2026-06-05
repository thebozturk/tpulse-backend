---
name: prisma-migrations
keywords: "migrate, migration, schema, deploy, rollback, shadow"
description: "Migration workflow — dev/deploy, rollback strategy"
---

# Migrations

## Lifecycle

### Development
```bash
# Schema değiştir → migration oluştur + apply
npx prisma migrate dev --name add_user_role

# Mevcut DB ile schema'yı sync et (ilk kez)
npx prisma migrate dev --name init

# Schema değişikliğini hızlı test (migration üretmeden, NON-PERSISTENT)
npx prisma db push
```

`migrate dev`:
1. Schema diff çıkarır
2. `prisma/migrations/<timestamp>_name/migration.sql` oluşturur
3. Shadow DB'de test eder
4. Production-like DB'ye apply eder
5. Prisma Client regenerate eder

### Production deploy
```bash
# Production'da SADECE bunu kullan
npx prisma migrate deploy
```

`migrate deploy`:
- Yeni migration üretmez
- Shadow DB kullanmaz
- Sadece pending migration'ları sırayla uygular
- Idempotent (aynı migration 2 kez apply etmez)

## Migration file structure

```
prisma/
├── schema.prisma
├── migrations/
│   ├── 20260101120000_init/
│   │   └── migration.sql
│   ├── 20260102140530_add_user_role/
│   │   └── migration.sql
│   └── migration_lock.toml
```

## Migration best practices

### Atomic — tek değişiklik per migration
**Yanlış**: User table değişikliği + Post field rename + new index — tek migration.
**Doğru**: 3 ayrı migration. Rollback granular olur.

### Reversible
Her migration için DOWN düşün. Prisma otomatik DOWN yazmaz ama düşünceli yaz.

### No data manipulation in migration
Schema migration ≠ data migration. Data değişikliği için ayrı script:
```bash
prisma/seed.ts          → seed data
scripts/migrate-data.ts → data transformation
```

Schema migration data'yı koruyacak şekilde yaz (ALTER TABLE, drop after copy gibi).

### Breaking changes 2-step
```
1. Add new column (nullable)
2. Application code dual-write (old + new)
3. Backfill data
4. Application code reads new only
5. Drop old column

Tek migration olmaz — production'da deploy ile uyumsuzluk = downtime.
```

## SQL preview

Migration apply etmeden SQL gör:
```bash
npx prisma migrate dev --create-only --name add_index
# migration.sql üretilir, apply EDİLMEZ
# İncele, gerekirse manuel düzenle, sonra apply:
npx prisma migrate dev
```

## Manual SQL migration

Kompleks migration (custom function, GIN index gibi) — Prisma generate edemez:

```bash
npx prisma migrate dev --create-only --name add_fulltext_index
# Generated SQL'i open et, manuel ekle:
```

```sql
-- prisma/migrations/.../migration.sql
ALTER TABLE "Post" ADD COLUMN "search_vector" tsvector;

CREATE INDEX post_search_idx ON "Post" USING GIN(search_vector);

CREATE TRIGGER post_search_update BEFORE INSERT OR UPDATE ON "Post"
  FOR EACH ROW EXECUTE FUNCTION
  tsvector_update_trigger(search_vector, 'pg_catalog.turkish', title, content);
```

Sonra `migrate dev` to apply.

## Rollback

Prisma `migrate down` kavramı YOK. İki yol:

### 1. Yeni migration ile geri al
```bash
# Önceki schema'yı restore et, migrate
git revert HEAD              # schema.prisma eski haline
npx prisma migrate dev --name revert_user_role
```

### 2. Production'da prisma migrate resolve
```bash
# Migration uygulandı ama broken — markala
npx prisma migrate resolve --rolled-back 20260101120000_broken

# Veya force apply
npx prisma migrate resolve --applied 20260101120000_fixed_manually
```

## Environment-specific

### Shadow database (CI/CD)
```bash
# .env
SHADOW_DATABASE_URL="postgresql://user:pass@localhost:5432/app_shadow?schema=public"
```

`migrate dev` shadow DB'de migration'ı önce dener (dev DB'de revert edilemez ihtimaline karşı).

CI'da gerekli olduğunda da shadow DB conn:
```yaml
# .github/workflows/ci.yml
services:
  postgres:
    image: postgres:16
    env:
      POSTGRES_DB: app_shadow
```

### Schema check (CI)
```bash
npx prisma validate          # schema syntax + relation valid mi
npx prisma format            # auto-format
```

CI'da migration drift check:
```bash
npx prisma migrate status
# Pending migrations? Schema-DB drift?
```

## Production deployment pattern

```dockerfile
# Dockerfile entrypoint
CMD npx prisma migrate deploy && node dist/main.js
```

Veya init container (Kubernetes):
```yaml
initContainers:
  - name: migrate
    image: app:latest
    command: ["npx", "prisma", "migrate", "deploy"]
containers:
  - name: app
    image: app:latest
```

Migration tek instance'da çalışsın → race condition önlemi.

## Naming convention

```
20260101120000_init
20260102140530_add_user_role
20260103091022_add_post_indexes
20260104153010_remove_legacy_field
```

Format: `YYYYMMDDHHmmss_descriptive_snake_case`.

Verb seçimi:
- `add_*` — yeni column/table
- `remove_*` — drop
- `rename_*` — rename
- `change_*` — alter type
- `index_*` — new index

## Anti-pattern'ler

### `prisma db push` production'da
```bash
# ❌ Migration üretmez, history yok
npx prisma db push
```

`db push` sadece prototyping. Production'da ASLA. Hep `migrate dev` (dev) + `migrate deploy` (prod).

### Migration SQL'i edit etmek (apply sonrası)
Migration file commit edildikten sonra DEĞİŞTİRME. Yeni migration aç.

### `migrate reset` production'da
Tüm DB drop eder. Sadece development için.

### Application code + migration aynı PR'da
Application yeni column'u expect ediyor, migration deploy gecikti → 500 errors.

**Doğru**: Migration first deploy, sonra application code.

## Aksiyon

1. Local: `prisma migrate dev --name <descriptive>`
2. CI: `prisma validate` + `prisma migrate status`
3. Production: `prisma migrate deploy` (deploy time, init container ideal)
4. Atomic migrations (tek değişiklik per migration)
5. Breaking change → 2-step deploy (add → backfill → use → drop)
6. Manual SQL için `--create-only` + manuel edit + apply
