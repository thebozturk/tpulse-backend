# /onboard — Mevcut Projeye Uyum

$ARGUMENTS: Opsiyonel. `deep` → daha detaylı tarama (varsayılan: standart).

## Amaç

Projeyi tara, teknoloji stack'ini ve convention'ları tespit et, `.factory/memory/conventions.json`'a yaz. Factory bu projeye özel hale getirilir.

## Protocol

1. **TARAMA** — Dosya yapısı, framework, linter, test runner
2. **RAPORLA** — Tespit edilenleri kullanıcıya göster
3. **ONAYLA** — Yanlış tespit varsa kullanıcı düzeltir
4. **YAZ** — `conventions.json` ve `codebase-map.json` oluştur
5. **YÖNLENDİR** — Sonraki adım önerisi

## Context Bütçesi: Max 40k token

---

## AŞAMA 1: TARAMA

Dosya okuma değil, **grep/find ile metadata** topla. Tüm source'u okuma.

### Framework ve dil tespiti

```
package.json varsa → Node.js projesi
  ├── @nestjs/core → NestJS backend
  ├── next → Next.js frontend
  ├── react (next yoksa) → React SPA/CRA
  └── express, fastify → minimal backend
pyproject.toml / requirements.txt → Python
Cargo.toml → Rust
go.mod → Go
```

### Yapı tespiti

Dosya path pattern'larını oku (içerikleri değil):
- `src/app/` → Next.js App Router
- `src/pages/` → Next.js Pages Router
- `src/modules/` → NestJS feature-based
- `src/controllers/`, `src/services/` → layered
- `prisma/schema.prisma` → Prisma ORM
- `schemas/*.ts` → Mongoose
- `*.gateway.ts` → NestJS WebSocket gateway
- `@Sse(` grep → SSE endpoint var
- `EventSource` grep frontend → SSE consume
- `socket.io-client` package → WebSocket consume
- `ioredis` + pub/sub pattern → multi-instance event bus
- Kubernetes/k8s manifest, docker-compose'ta `replicas: > 1` → multi-instance

### Mobile detection (v1.6.0+)

- `app.config.ts` veya `app.json` + `expo` package → Expo managed workflow
- `package.json` → `"main": "expo-router/entry"` → Expo Router
- `app/` klasörü + `_layout.tsx` → Expo Router file-based routing
- `react-native` package olup `expo` yoksa → Bare RN (managed değil)
- `@react-navigation/native` → React Navigation kullanımı
- `eas.json` → EAS Build/Submit config
- `nativewind` package → NativeWind v4 styling
- `react-native-mmkv` → MMKV storage
- `expo-notifications` → managed push setup
- `react-native-purchases` → RevenueCat subscription
- `@sentry/react-native` → Sentry crash reporting
- `@react-native-firebase/analytics` → Firebase Analytics

Mobile flag'lerini conventions.json'a yaz:
- `mobile.workflow` — `"managed"` | `"bare"`
- `mobile.navigation` — `"expo-router"` | `"react-navigation"`
- `mobile.features.push` — boolean (expo-notifications var mı)
- `mobile.features.subscription` — boolean (react-native-purchases)
- `mobile.features.analytics` — boolean
- `mobile.features.crash` — boolean (Sentry)

### Stack feature flags (v1.4.0+)

Bu binary tespit'leri conventions.json'a flag olarak yaz:
- `streaming.sse` — `@Sse(` grep ile bulundu mu
- `streaming.websocket` — `@WebSocketGateway` grep
- `streaming.eventBus` — Redis pub/sub kod
- `multiInstance` — replicas > 1, k8s deployment, veya açıkça multi-instance kurulmuş
- `orm` — `prisma` | `mongoose` | `none`
- `database` — `postgresql` | `mongodb` | `mysql` | `none`

### Config dosyaları

- `.eslintrc*` → lint rules
- `.prettierrc*` → format config
- `tsconfig.json` → strict mode, path alias
- `jest.config.*` veya `vitest.config.*` → test framework
- `.env.example` → env variable listesi
- `Dockerfile`, `docker-compose.yml` → deploy setup

### Naming convention tespiti

Birkaç dosyadan örnekleme:
- File naming: `kebab-case.ts`? `camelCase.ts`? `PascalCase.ts`?
- Variable naming: `camelCase`? `snake_case`?
- Class naming: `PascalCase` (varsayılan)
- Private field: `_private` prefix mi?

Bir iki dosyayı grep'le, pattern'i çıkar:
```bash
# örnek: private prefix var mı
grep -r "private _" src --include="*.ts" | head -3
```

### Test coverage baseline

- `coverage/` klasörü varsa son rapor oku (`coverage-summary.json`)
- Yoksa `npm test -- --coverage` çalıştırma — sadece olup olmadığını raporla

### Git geçmişi ipuçları

- Son 10 commit mesajı: conventional commits kullanılıyor mu?
- Branch naming pattern: `feature/...`? `feat/...`? `users/...`?

---

## AŞAMA 2: RAPORLA

Kullanıcıya **yapılandırılmış özet** ver:

```
TESPIT EDİLEN:
- Stack: NestJS 10 + MongoDB (Mongoose)
- Yapı: Feature-based modules (src/modules/*)
- Naming: camelCase dosya adları, PascalCase class
- Test: Jest, %72 coverage baseline
- Lint: ESLint + Prettier, strict TypeScript
- Container: Dockerfile + docker-compose.yml var
- Commit style: Conventional commits (feat:, fix:, ...)
- Branch style: feature/<isim>

BULAMADIĞIM:
- OpenAPI spec (swagger setup var ama çıktı üretimi yok)
- Migration stratejisi (hiç migration dosyası yok)
- Runbook / incident response dokümanı

Bu tespit doğru mu? Düzeltmen gereken var mı?
```

---

## AŞAMA 3: ONAYLA

Kullanıcı onay ya da düzeltme verir. **Onay almadan dosya yazma.**

---

## AŞAMA 4: YAZ

### `.factory/memory/conventions.json`

```json
{
  "stack": {
    "runtime": "node",
    "framework": "nestjs",
    "orm": "mongoose",
    "database": "mongodb",
    "language": "typescript"
  },
  "features": {
    "streaming": {
      "sse": false,
      "websocket": false,
      "eventBus": false
    },
    "multiInstance": false,
    "seo": false
  },
  "structure": {
    "pattern": "feature-based",
    "src_root": "src",
    "test_pattern": "*.spec.ts"
  },
  "naming": {
    "files": "kebab-case",
    "classes": "PascalCase",
    "variables": "camelCase",
    "constants": "UPPER_SNAKE_CASE",
    "private_prefix": null
  },
  "tooling": {
    "linter": "eslint",
    "formatter": "prettier",
    "test_framework": "jest",
    "package_manager": "pnpm"
  },
  "commits": {
    "style": "conventional",
    "branch_pattern": "feature/<name>"
  },
  "testing": {
    "coverage_baseline": 72,
    "types": ["unit", "integration"]
  },
  "missing": [
    "openapi_generation",
    "migrations",
    "runbooks"
  ]
}
```

### `.factory/memory/codebase-map.json` (opsiyonel, büyük projelerde)

Class → dosya haritası. Sadece `deep` argümanı verildiyse oluştur:
```json
{
  "classes": {
    "UserController": "src/modules/users/user.controller.ts",
    "UserService": "src/modules/users/user.service.ts"
  },
  "modules": [
    "src/modules/users",
    "src/modules/auth"
  ]
}
```

---

## AŞAMA 5: YÖNLENDİR

Eksiklik varsa önerilerde bulun:

```
✓ Onboard tamamlandı.

ÖNERİLER:
1. OpenAPI otomatik üretimi eksik → Parça 4 (Contract Layer) kurulunca ekleyelim
2. Migration yok → /schema-migrate komutu ile başlayabiliriz
3. Runbook dokümantasyonu yok → /design ile oluşturabilirsin

SONRAKI ADIM:
- Yeni modül için: /design "modül açıklaması"
- Yeni endpoint için: /endpoint "endpoint açıklaması"
- Yarım kalan iş için: /resume
```

---

## YAPMA

- **Tüm source dosyalarını okuma.** Sadece pattern tespiti için grep.
- **Tahmin etme.** Emin değilsen kullanıcıya sor.
- **Convention dayatma.** Proje `_camelCase` kullanıyorsa rules/ `camelCase` dese bile `_camelCase` yaz.
- **Git geçmişinde 100'den fazla commit oku.** Son 10-20 yeterli.
- **Onaysız conventions.json yaz.** Rapor → onay → yaz sırasına uy.
