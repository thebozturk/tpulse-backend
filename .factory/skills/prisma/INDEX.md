# Prisma + PostgreSQL Skills

Type-safe ORM, declarative schema, migration tool.

- [setup.md](setup.md) — kurulum, NestJS provider, env config
- [schema.md](schema.md) — schema.prisma, model, naming conventions
- [migrations.md](migrations.md) — migrate dev/deploy, rollback
- [relations.md](relations.md) — 1:1, 1:n, n:m, self-relation
- [queries.md](queries.md) — find/create/update/delete, transactions, raw SQL
- [seeding.md](seeding.md) — seed.ts, fixtures, faker
- [performance.md](performance.md) — N+1, connection pool, query optimization
- [validation.md](validation.md) — zod integration, runtime validation

## Ne zaman hangi skill?

| Senaryo | Oku |
|---------|-----|
| Yeni proje setup | setup.md |
| Yeni model ekleme | schema.md, relations.md |
| Schema değişikliği | migrations.md |
| Production deploy | migrations.md (deploy mode) |
| Yavaş query | performance.md, queries.md |
| Test data | seeding.md |
| Type-safe DTO | validation.md |
