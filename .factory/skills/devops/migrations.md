---
name: devops-migrations
keywords: "migration, deploy, forward-only"
description: "Migration deployment stratejisi"
---

> **Stack-aware:** Bu skill MongoDB migration deploy stratejisi. Prisma+PostgreSQL projelerinde `prisma/migrations.md` (`migrate dev` vs `migrate deploy`, shadow DB, rollback) bağlayıcıdır.


# Migration Deploy

Bkz. `mongodb/migrations.md` — migration yazımı.

## CI/CD pipeline

```yaml
# .github/workflows/deploy.yml
- name: Run migrations
  run: npx migrate-mongo up
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}

- name: Deploy backend
  run: ...
```

Migration deploy'dan **önce** çalışır.

## Expand-contract

Breaking schema change:

1. **Migration 1** — yeni field ekle (optional)
2. **Deploy** v1.1 (yeni field'ı yazar ama okumaz)
3. **Migration 2** — backfill data
4. **Deploy** v1.2 (yeni field'ı okur)
5. **Migration 3** — eski field sil

Downtime-free.

## Backup zorunlu

Migration'dan önce:
```bash
mongodump --uri=$DATABASE_URL --out=backup-$(date +%Y%m%d)
aws s3 cp backup-... s3://acme-backup/
```

## Staging test

Production-like data ile staging'de test. Performance, data integrity.

## Aksiyon

- CI pipeline'da migrate-mongo up
- Deploy öncesi backup
- Breaking change → expand-contract
- Staging'de test
