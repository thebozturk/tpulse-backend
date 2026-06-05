# [Proje Adı]

<!-- Bu başlığı ve açıklamayı onboard sonrası güncelle -->
<!-- Örn: "Acme API — NestJS + MongoDB backend" -->

## Nasıl Başlarım?

Yeni modül: `/design "modül açıklaması"` → `/build <modül-adı>`
Mevcut projeye: `/onboard`
Yarım kalan iş: `/resume`
Komut listesi: `/help`

## Referanslar

- Modül spec'leri: `.factory/docs/modules/`
- Konvansiyonlar: `.factory/memory/conventions.json`
- Skill haritası: `.factory/skills/INDEX.md`
- Öğrenilmiş kurallar: `.factory/rules/learned/`

## Asla Yapma

- Spec'te tanımlı olmayan özellik ekleme (scope creep)
- main/master branch'e doğrudan commit
- Uncommitted değişiklikleri branch değiştirmeden bırakma
- Hardcoded secret (env var kullan)
- Test yazmadan production kod commit

<!-- SESSION STATE -->
<!-- Post-compact hook tarafından otomatik güncellenir. ELLE DOKUNMA. -->
<!-- END SESSION STATE -->
# Backend-Specific Claude Instructions

Bu proje **NestJS + MongoDB + Docker** backend. Factory framework v1.1.0+ ile yönetiliyor.

## Project stack

- **Runtime:** Node.js 20.11+
- **Framework:** NestJS 10+
- **Database:** MongoDB 7.0 (replica set zorunlu — transaction için) **veya** PostgreSQL 16+
- **ORM:** Mongoose **veya** Prisma 5+ (her proje birini seçer; v1.4.0 ikisini de destekler)
- **Cache/Session:** Redis 7.2+ (event bus için pub/sub destekli)
- **Streaming:** SSE (`@Sse` decorator) **veya** WebSocket (`@WebSocketGateway` + Socket.IO)
- **Language:** TypeScript strict mode
- **Package manager:** pnpm
- **Test:** Jest + supertest + testcontainers

`.factory/memory/conventions.json`'da `stack.orm`, `stack.database`, `features.streaming.*` flag'leri tutulur — `/onboard` bunları yazar.

## Folder structure

```
src/
├── main.ts
├── app.module.ts
├── config/                # Env validation
├── common/
│   ├── decorators/
│   ├── filters/           # Global exception filter
│   ├── guards/            # JwtAuth, Roles, Trust
│   ├── interceptors/      # Logging, timeout, metrics
│   ├── pipes/             # ObjectIdPipe, etc.
│   └── validators/        # Custom class-validator
├── modules/               # FEATURE MODULE'LAR (katman değil feature)
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── dto/
│   │   ├── strategies/    # JWT, Google OAuth
│   │   └── schemas/
│   ├── users/
│   └── ...
└── health/
```

**Kural:** Layered (controllers/, services/, repositories/) DEĞİL, feature-based organizasyon.

## Zorunlu hooks

Factory şu hook'ları aktive etmiştir:
- `session-start.sh` — context banner + failure recovery
- `post-compact.sh` — kritik context'i hatırla
- `enrich-prompt.sh` — skill önerisi
- `on-stop.sh` — completion check
- `validate-write.sh` — convention check (pre-write)
- `post-write-check.sh` — anti-pattern scan (post-write)
- `security-gate.sh` — kritik ihlal BLOCK (pre-write)
- `contract-drift-check.sh` — contract güncelleme uyarı

Bu hook'lar `.factory/memory/error-log.jsonl`'e kayıt atar. Çalışırken incele.

## Required guards

Her controller'da:
- `@UseGuards(JwtAuthGuard, RolesGuard)` default
- `@Public()` decorator ile bypass (login, register, health)
- `@Throttle()` sensitive endpoint'lerde

## Response format

Success:
```json
{ "data": { ... }, "meta": { "timestamp": "..." } }
```

Error (global filter):
```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "...",
  "errors": [...],
  "requestId": "...",
  "timestamp": "...",
  "path": "..."
}
```

## Güvenlik baseline

- `main.ts`'te `helmet()` + global `ValidationPipe` + CORS whitelist
- `select: false` her hassas field'da (password, refreshTokenHash, mfaSecret)
- Rate limit multi-tier (1s, 1dk, 1sa)
- `@nestjs/throttler` Redis storage (multi-pod)
- `class-validator` whitelist + forbidNonWhitelisted zorunlu

## Kodlama prensipleri

1. **Feature-based, DI-first.** Constructor injection. `new` ile instantiation YOK.
2. **Repository abstraction.** Service DB'ye değil interface'e bağımlı.
3. **DTO + schema ayrı.** DTO = request/response, Schema = DB.
4. **Strict mode.** `any` yasak. `unknown` OK.
5. **Async error handling.** `try/catch` veya typed exception throw.
6. **No console.log.** Logger inject.
7. **No magic string/number.** Enum veya config.

## Skill'ler

İhtiyaca göre `.factory/skills/`'den oku:
- Domain: `nestjs/`, `api/`, `mongodb/`, `prisma/`, `postgres/`, `auth/`
- Cross-cutting: `security/`, `bot-defense/`, `resilience/`, `performance/`, `observability/`
- Real-time: `streaming/` (sse-emit, websocket, event-bus)
- Infra: `testing/`, `devops/`

Her kategoride `INDEX.md` ile önce genel bakış, sonra detay skill'i aç.

**Stack-aware seçim:**
- conventions.json `orm: prisma` → `prisma/` + `postgres/` skill'leri
- conventions.json `orm: mongoose` → `mongodb/` skill'leri
- Mixed proje (legacy migration) → ikisi de okunabilir, ama **bir model'i iki ORM ile yönetme**

## Workflow komutları

- `/build <spec>` — 5-phase: plan → code → env → verify → commit
- `/endpoint <spec>` — tek endpoint ekle (lightweight)
- `/module <n>` — empty module scaffold
- `/db init|migrate|schema|seed|reset` — Prisma/Mongoose database ops (v1.4.0+)
- `/stream <event>` — SSE veya WebSocket endpoint scaffold (v1.4.0+)
- `/secure` — 8-category audit
- `/contract-publish` — OpenAPI export, breaking change check

## Test & verify

Her `/build` sonrası:
```bash
pnpm tsc --noEmit         # type check
pnpm lint                  # eslint
pnpm test                  # unit
pnpm test:e2e              # e2e (slower)
```

CI aynısını yapar + security audit.

## Memory & learned

- `.factory/memory/error-log.jsonl` — hook'ların tespit ettiği ihlaller
- `.factory/memory/completions.jsonl` — başarılı build'ler
- `.factory/learned/` — proje-spesifik öğrenilen pattern'lar

Factory bu dosyalara DOKUNMAZ (protected path). Claude her session başında okumalı.

## Contract

`openapi.json` her breaking change'te güncellenir. `/contract-publish` komutu:
1. OpenAPI JSON generate
2. Önceki ile diff
3. Breaking varsa major bump uyarısı
4. Submodule (contract-bridge repo) push

Frontend bu contract'ı tüketir — breaking değişikliği iletmemek = frontend kırar.

## Architectural Discipline (v1.5.0+)

Her dosya yazılırken **3 soru** sor:

1. **"Bu kod hangi soruyu cevaplıyor?"** — birden fazla cevap = SRP ihlali, böl.
2. **"Bu davranış değişimi nereden?"** — `if/else` ise Strategy + Factory aday.
3. **"Bu bağımlılık nereden geldi?"** — `new` ise DI ile dışarı çıkar.

### Pattern skill'leri

`shared/.factory/skills/patterns/`:
- `INDEX.md`, `solid-principles.md`, `layered-architecture.md`
- `singleton.md`, `repository.md`, `service-layer.md`, `strategy.md`, `factory.md`, `dependency-injection.md`
- `anti-patterns.md` — 15 yaygın tuzak

`profiles/backend/.factory/skills/architecture/`:
- `feature-flags.md`, `middleware-chain.md`, `error-handling.md`
- `validation-discipline.md`, `auth-authz-boundaries.md`
- `rate-limiting.md`, `config-management.md`

### Yeni komut

- `/architecture review [path]` — mimari incelemesi
- `/architecture refactor <pattern> [path]` — refactor (strategy/repository/factory/di/service-extract)
- `/architecture audit` — tüm projede anti-pattern envanteri

### Yeni agent

- `architecture-reviewer` — read-only, 6-boyutlu inceleme (layer/SOLID/pattern/DI/anti-pattern/refactor)

### Hook'tan eğitici uyarılar (warning, BLOCK değil)

- Controller'da `if (flags.X)` → "Strategy aday"
- Service'de `req`/`res` → "service HTTP'yi bilmemeli"
- Repository'de `if (user.role === ...)` → "business kararı service'te"
- `findById(id)` userId-less → "Broken Access Control riski"
