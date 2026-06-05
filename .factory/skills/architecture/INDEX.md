# Backend Architecture Skills

NestJS / Express backend için derin mimari pattern'lar.

> **Önce shared/.factory/skills/patterns/ oku** — SOLID, Strategy, Factory, DI, Repository, Service, Anti-patterns. Bu dosyalar profil-bağımsız foundation'dır.

Bu kategori backend'e özel:

- [feature-flags.md](feature-flags.md) — FF servisi (type-safe, hot reload, override testleri)
- [middleware-chain.md](middleware-chain.md) — Sıralama mantığı, route-specific middleware
- [error-handling.md](error-handling.md) — BaseError + tip sınıfları, async wrapper, global handler
- [validation-discipline.md](validation-discipline.md) — Middleware seviyesinde zod validation
- [auth-authz-boundaries.md](auth-authz-boundaries.md) — Authentication vs Authorization, ownership check
- [rate-limiting.md](rate-limiting.md) — Token bucket, route-specific, FF entegrasyonu
- [config-management.md](config-management.md) — env vs constants vs FF, fail-fast validation

## Konu eşleşmesi

| Soru | Skill |
|------|-------|
| Yeni FF nasıl eklenir? | feature-flags |
| FF runtime'da nasıl değişir? | feature-flags (hot reload) |
| Middleware hangi sırada? | middleware-chain |
| Custom error nasıl yazılır? | error-handling |
| zod schema nereye konur? | validation-discipline |
| Sahiplik kontrolü nasıl? | auth-authz-boundaries |
| Rate limit per-route nasıl? | rate-limiting |
| Env'de yanlış değer varsa? | config-management (fail-fast) |
