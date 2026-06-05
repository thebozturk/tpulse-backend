# /contract-publish — OpenAPI Contract Yayınlama

$ARGUMENTS: Opsiyonel. `--force` → breaking change varsa da yayınla.

## Amaç

NestJS Swagger'dan `openapi.json` üret, contract repo/submodule'e kopyala, breaking change tespit et, commit & push.

## Protocol

1. **SETUP KONTROL** — Swagger kuruluyor mu
2. **OPENAPI ÜRET** — App'i boot et, spec export
3. **BREAKING CHECK** — Eski vs yeni diff
4. **ONAYLA** (breaking varsa)
5. **COMMIT + PUSH** (contract repo'ya)
6. **FRONTEND NOTİFİKASYON**

## Context Bütçesi: Max 15k token

---

## AŞAMA 1: SETUP KONTROL

Swagger setup doğru mu?

```bash
# main.ts'te SwaggerModule.setup var mı
grep "SwaggerModule.setup\|DocumentBuilder" src/main.ts
```

Yoksa kur:
```bash
pnpm add @nestjs/swagger
```

`main.ts`'te:
```typescript
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

const config = new DocumentBuilder()
  .setTitle('Acme API')
  .setDescription('Acme backend API')
  .setVersion('1.0')
  .addBearerAuth()
  .build();

const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api/docs', app, document);

// Export için dosyaya da yaz
if (process.env.EXPORT_OPENAPI === 'true') {
  const fs = await import('fs');
  fs.writeFileSync('./openapi.json', JSON.stringify(document, null, 2));
  process.exit(0);
}
```

---

## AŞAMA 2: OPENAPI ÜRET

App'i export modunda çalıştır:

```bash
EXPORT_OPENAPI=true pnpm start
```

Veya script ekle (`package.json`):
```json
{
  "scripts": {
    "openapi:gen": "EXPORT_OPENAPI=true node dist/main"
  }
}
```

```bash
pnpm build
pnpm openapi:gen
# → openapi.json üretildi
```

### Sağlık kontrolü

```bash
# JSON geçerli mi
jq empty openapi.json

# Endpoint sayısı
jq '.paths | keys | length' openapi.json

# Schema sayısı
jq '.components.schemas | keys | length' openapi.json
```

---

## AŞAMA 3: CONTRACT LOKASYONU

Contract repo nerede?

```bash
# Olası lokasyonlar
ls contract/ 2>/dev/null         # submodule
ls ../contract/ 2>/dev/null      # sibling dir
ls .factory/contract/ 2>/dev/null # factory altında
```

Contract yoksa kullanıcıya:
```
Contract repo bulunamadı. Seçenekler:

1. Git submodule olarak ekle:
   git submodule add git@github.com:acme/contract.git contract

2. Sibling dir olarak clone'la (monorepo değil polyrepo)

3. Şimdilik local üret, manuel yayınla:
   openapi.json burada — ona bak, sonra nereye koyacaksın?

Hangisi?
```

---

## AŞAMA 4: BREAKING CHANGE KONTROL

Eski openapi vs yeni karşılaştır:

```bash
# openapi-diff ile (npm -g install openapi-diff)
openapi-diff contract/openapi.json openapi.json
```

Veya basit jq karşılaştırması:
```bash
# Eski endpoint'ler hala var mı
jq -r '.paths | keys[]' contract/openapi.json > /tmp/old-paths.txt
jq -r '.paths | keys[]' openapi.json > /tmp/new-paths.txt
diff /tmp/old-paths.txt /tmp/new-paths.txt
```

### Breaking change tipleri

- **Endpoint silindi** → BREAKING
- **Endpoint method değişti** → BREAKING
- **Required field eklendi request body'ye** → BREAKING
- **Required field çıkarıldı response'tan** → BREAKING
- **Field tipi değişti** (string → number) → BREAKING
- **Yeni endpoint** → non-breaking
- **Optional field eklendi** → non-breaking

### Breaking varsa onay iste

```
⚠️ BREAKING CHANGES tespit edildi:

- DELETE /users/:id/avatar → method PUT olmuş
- POST /auth/login → "rememberMe" field'i yeni required

Frontend'i kıracak. Onay?
  1. Yayınla (frontend takımına bilgi ver)
  2. Yayınlama (kodu eski contract'a uygun geri al)
  3. Minor version bump (v1.x → v2.0, frontend major upgrade)

Seçim? [1/2/3]
```

`--force` flag'i varsa onay atla.

---

## AŞAMA 5: CONTRACT'A PUBLISH

```bash
# Contract repo dizinine git
cd contract

# openapi.json'ı kopyala
cp ../openapi.json ./openapi.json

# Types üret
pnpm generate:types
# veya
openapi-typescript openapi.json -o types/api.d.ts

# VERSION bump (breaking ise major, yoksa minor)
# Manuel veya semver CLI ile
# Örn: v1.2.0 → v1.3.0 (non-breaking)
# Örn: v1.2.0 → v2.0.0 (breaking)
echo "v1.3.0" > VERSION

# CHANGELOG güncelle
cat >> CHANGELOG.md <<EOF

## [v1.3.0] - $(date +%Y-%m-%d)

### Added
- POST /profile/avatar endpoint

### Changed
- UserDto: avatar field artık opsiyonel

EOF

# Commit
git add -A
git commit -m "feat: publish api v1.3.0 (non-breaking)"
git tag v1.3.0
git push origin main --tags

cd ..
```

---

## AŞAMA 6: FRONTEND NOTİFİKASYON

```
✓ Contract yayınlandı

Versiyon: v1.2.0 → v1.3.0
Endpoint değişimi: 2 eklendi, 0 kaldırıldı, 1 değişti
Breaking: YOK

Frontend takımı için:
  cd frontend-repo
  factory run /contract-sync

Slack mesajı (önerilen):
  📢 Backend API v1.3.0 yayınlandı
  • Yeni: POST /profile/avatar
  • Değişen: UserDto.avatar opsiyonel
  • Breaking: yok
  Frontend güncellemesi: /contract-sync
```

---

## YAPMA

- **Breaking change'i sessizce yayınla.** Onay zorunlu veya --force explicit.
- **openapi.json'ı manuel edit et.** NestJS generate eder, manuel değişiklik bozar.
- **Contract repo'ya production build olmadan yayınla.** Swagger dev'de kısmi olabilir.
- **Version bump'ı atla.** Her publish versiyonlu — frontend pin'leyebilir.
- **Breaking change'i minor version'da yayınla.** Semver ihlali — major bump zorunlu.
