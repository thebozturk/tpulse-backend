# /build — Backend Modül İnşası

$ARGUMENTS: Modül adı (zorunlu). Örn: `user-profile-avatar`, `auth-refresh-flow`.

## Amaç

Spec'ten kod + test + docker-compose güncelleme + commit üreten tam akış. Sadece kod yazmaz — ortamı kurar, migration çalıştırır, testi yazıp çalıştırır, sonunda commit eder.

## Protocol

1. **PLAN** — Spec oku, convention'ları oku, plan çıkar, onay al
2. **KOD YAZ** — Plan onaylandıktan sonra dosyaları oluştur
3. **ORTAM KUR** — Paket install, migration, env variable, docker-compose update
4. **DOĞRULA** — Compile, lint, smoke test, unit test, regression
5. **COMMIT** — Conventional commit, active-task güncelle

## Context Bütçesi: Max 25k token

---

## AŞAMA 1: PLAN

### Önkoşul: Spec dosyası

`.factory/docs/modules/$ARGUMENTS.md` **OLMAK ZORUNDA**. Yoksa:

```
❌ Spec dosyası yok: .factory/docs/modules/$ARGUMENTS.md

Önce /design ile spec oluştur:
  /design "$ARGUMENTS"

Bu spec'i okumadan build yapmam — scope drift riski.
```

### Önkoşul: Git branch

Mevcut branch `main`/`master`/korumalı ise DUR:
```bash
git branch --show-current
```

Feature branch'e çıkmanı iste:
```bash
git checkout -b feature/$ARGUMENTS
```

### Oku (sırayla, her birini)

1. `.factory/docs/modules/$ARGUMENTS.md` — spec
2. `.factory/memory/conventions.json` — proje convention'ları
3. `.factory/memory/active-task.md` (varsa) — yarım kalan iş var mı
4. İlgili path-scoped rules (`.claude/rules/api.md`, `dto.md`, `service.md`, vs.)
5. İlgili skill'ler (max 3 — prompt'ta hangi keyword'ler varsa):
   - `auth` varsa → `.factory/skills/auth/INDEX.md`
   - `schema`/`mongodb` varsa → `.factory/skills/mongodb/INDEX.md`
   - `endpoint` varsa → `.factory/skills/api/INDEX.md`

### Plan çıkar

Kullanıcıya **yapılandırılmış** plan ver:

```
PLAN: $ARGUMENTS

Değişecek dosyalar:
  YENİ src/modules/<feature>/<feature>.module.ts
  YENİ src/modules/<feature>/<feature>.controller.ts
  YENİ src/modules/<feature>/<feature>.service.ts
  YENİ src/modules/<feature>/dto/create-<feature>.dto.ts
  YENİ src/modules/<feature>/schemas/<feature>.schema.ts
  YENİ test/<feature>.spec.ts
  DEĞİŞ src/app.module.ts (+1 import)

Paket:
  + bcryptjs (yeni)
  + @types/bcryptjs (dev, yeni)

Env variables:
  + BCRYPT_ROUNDS=12 (.env.example'a)

Docker-compose:
  (değişiklik gerekmez)

Tahmini süre: 20dk
Test sayısı hedef: 8 (5 unit + 3 integration)

Bu planla devam edeyim mi?
```

Kullanıcı onayladıktan sonra devam et. Değiştirmek isterse revize et.

---

## AŞAMA 2: KOD YAZ

### Sıra (her zaman bu sıra):

1. **Schema** (MongoDB model)
2. **DTO** (input validation)
3. **Service** (business logic)
4. **Controller** (HTTP layer)
5. **Module** (DI registration)
6. **Test** (spec'te tanımlı senaryolar)
7. **app.module.ts** update (yeni module'u import et)

### Her dosya yazılırken

- **Convention'a uy** — conventions.json'daki naming
- **Skill pattern'larını uygula** — örn. service skill'i "constructor injection" diyor
- **Post-write hook uyarısı gelirse DÜZELT** — "any type kullanıldı" → explicit type yap
- **Security-gate BLOCK ederse DURUP DÜZELT** — hardcoded secret, select:false yok, vs.

### Snippet kullan

`.factory/snippets/` altında template'ler var. Oradan başla, ihtiyaca göre uyarla:
- `dto-template.ts` — DTO ile class-validator
- `service-template.ts` — constructor injection + logger
- `controller-template.ts` — guard + throttle + decorator'lar
- `schema-template.ts` — Mongoose schema + select:false
- `guard-template.ts` — auth guard pattern
- `test-template.spec.ts` — AAA pattern + mock

---

## AŞAMA 3: ORTAM KUR

### 3.1 Paket kurulumu

```bash
# Conventions'daki package_manager'a göre
pnpm add <paket> @<paket/types> ...
# veya
npm install ...
```

### 3.2 Env variables

`.env.example`'a yeni variable'ları ekle. Mevcut dosyayı oku, yoksa ekle:

```env
# Mevcut
DATABASE_URL=mongodb://localhost:27017/acme

# Yeni (bu build ile)
BCRYPT_ROUNDS=12
```

**ASLA** gerçek `.env` dosyasını düzenleme (security-gate bloklar).

### 3.3 Migration (schema değişimi varsa)

Schema dosyası değişti veya yeni schema var mı? Migration gerekli:

```bash
pnpm migrate:create <feature>-init
# migration dosyası oluşturulur → editle
pnpm migrate:up  # çalıştır
```

### 3.4 Docker-compose güncellemesi (varsa)

Spec'te "Redis gerekli" veya "minio gerekli" diyorsa `docker-compose.yml` güncelle. Sadece `docker-compose.dev.yml` veya yeni servis ekle — prod compose dokunulmaz.

---

## AŞAMA 4: DOĞRULA

Sırayla çalıştır (her biri fail olursa dur, düzelt):

### 4.1 TypeScript compile check
```bash
pnpm tsc --noEmit
```
Hata varsa düzelt. Burada takılırsan kullanıcıya göster.

### 4.2 Lint
```bash
pnpm lint
```
Uyarı varsa düzelt. Error'larsa zorunlu.

### 4.3 Unit test (yeni yazılan)
```bash
pnpm test -- <feature>.spec.ts
```
Beklenti: tüm testler yeşil. Fail varsa düzelt.

### 4.4 Integration test
```bash
pnpm test:integration -- <feature>
```
(varsa)

### 4.5 Regression (tüm test suite)
```bash
pnpm test
```
**Kritik:** yeni kod eski testi kırdı mı? Kırdıysa regression — düzelt.

### 4.6 Smoke test — uygulama ayakta mı
```bash
# docker-compose ile tam stack
docker compose up -d
sleep 5
curl -f http://localhost:3000/health
docker compose logs backend | tail -20
```

### 4.7 Endpoint manuel test (varsa)
```bash
curl -X POST http://localhost:3000/profile/avatar \
  -H "Authorization: Bearer <token>" \
  -F "file=@test.jpg"
```

---

## AŞAMA 5: COMMIT

### 5.1 Sadece ilgili dosyaları stage et

```bash
git status
# Hangi dosyalar yazıldı gör
git add src/modules/<feature>/ test/<feature>.spec.ts src/app.module.ts
git add .env.example  # değiştiyse
git diff --cached    # son kontrol
```

### 5.2 Conventional commit mesajı

```bash
git commit -m "feat(<feature>): <kısa özet>"
```

Örn:
- `feat(profile): add avatar upload endpoint`
- `feat(auth): add refresh token rotation`

### 5.3 active-task.md güncelle

Build başarıyla bittiyse aktif görev dosyasını temizle:

```bash
# active-task.md'yi sil veya arşivle
mv .factory/memory/active-task.md .factory/memory/completed-tasks.md
```

---

## AŞAMA 6: ÖZET

Kullanıcıya final özet:

```
✓ /build $ARGUMENTS tamamlandı

Yazılan dosyalar (7):
  src/modules/profile-avatar/profile-avatar.module.ts
  src/modules/profile-avatar/profile-avatar.controller.ts
  src/modules/profile-avatar/profile-avatar.service.ts
  src/modules/profile-avatar/dto/upload-avatar.dto.ts
  src/modules/profile-avatar/schemas/avatar.schema.ts
  test/profile-avatar.spec.ts
  [UPDATE] src/app.module.ts

Test sonuçları:
  Unit: 5/5 ✓
  Integration: 3/3 ✓
  Regression: 47/47 ✓ (0 test kırılmadı)
  Smoke: /profile/avatar POST 200 ✓

Commit: feat(profile-avatar): add avatar upload endpoint

Sonraki adım:
  - Contract yayınla: /contract-publish
  - Başka modül: /build <isim>
  - PR: git push origin feature/profile-avatar
```

---

## YAPMA

- **Spec dışı özellik ekleme.** "Bonus" olarak rate limit ekleyeyim deme — spec'te yoksa yapma.
- **Onay almadan kod yazma.** Plan göster → onay → yaz.
- **Test yazmadan commit.** Spec'teki test senaryoları zorunlu.
- **Security-gate BLOCK'u görmezden gel.** Hardcoded secret → sil, env'den al.
- **post-write-check uyarılarını bırakıp devam et.** "any type" warning → düzelt.
- **`main` branch'te commit.** protect-branch hook zaten bloklar.
- **Docker olmadan smoke test.** Gerçek smoke test docker-compose ile yapılır.
- **Migration olmadan schema değiştir.** Production'da veri kaybı.
- **`.env` (gerçek) dosyasını düzenle.** Sadece `.env.example`.
