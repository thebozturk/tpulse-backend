# /test — Test Çalıştırma

$ARGUMENTS: Test türü. Opsiyonlar: `smoke`, `unit`, `integration`, `e2e`, `coverage`, `all`. Boş bırakılırsa `smoke`.

## Amaç

Proje test suite'ini çalıştır, sonucu raporla, hata varsa agent'a düzeltme önerisi yaptır.

## Protocol

1. **TİP BELİRLE** — Kullanıcı ne test etmek istiyor
2. **KOMUTU TESPİT ET** — `conventions.json`'dan test framework'ü oku
3. **ÇALIŞTIR** — Bash ile komutu çalıştır
4. **YORUMLA** — Hata varsa analiz et, çözüm öner
5. **RAPORLA** — Başarı/başarısızlık özeti

## Context Bütçesi: Max 10k token

---

## AŞAMA 1: TİP BELİRLE

| Tip | Ne Test Eder | Ne Kadar Sürer |
|-----|-------------|----------------|
| `smoke` | Uygulama açılıyor mu, build var mı | 10-30sn |
| `unit` | Izole fonksiyon/method test'leri | 30sn-2dk |
| `integration` | Birden fazla modül birlikte | 1-5dk |
| `e2e` | Gerçek HTTP/browser ile full stack | 5-15dk |
| `coverage` | Tüm test'ler + coverage raporu | 2-10dk |
| `all` | unit + integration (e2e hariç) | 3-10dk |

`$ARGUMENTS` boşsa: `smoke` varsayılan (en hızlı doğrulama).

---

## AŞAMA 2: KOMUTU TESPİT ET

`.factory/memory/conventions.json`'dan oku:

```json
{
  "tooling": {
    "test_framework": "jest",
    "package_manager": "pnpm"
  }
}
```

Olası kombinasyonlar:
- **Jest + npm**: `npm test`, `npm run test:watch`, `npm run test:cov`
- **Jest + pnpm**: `pnpm test`, `pnpm run test:cov`
- **Vitest**: `vitest run`, `vitest --coverage`
- **Playwright** (e2e): `npx playwright test`
- **pytest**: `pytest`, `pytest --cov`

Package.json'a bak, `scripts` bölümünde ne varsa onu kullan:
```bash
cat package.json | jq '.scripts' 2>/dev/null
```

---

## AŞAMA 3: ÇALIŞTIR

Tip'e göre komutu seç ve bash ile çalıştır:

```bash
# smoke: build check veya app start
pnpm build 2>&1 | tail -20

# unit
pnpm test 2>&1 | tail -50

# integration
pnpm test:integration 2>&1 | tail -50

# e2e
pnpm test:e2e 2>&1 | tail -50

# coverage
pnpm test -- --coverage 2>&1 | tail -80
```

Uzun output'ları `tail -N` ile kırp — context'i şişirme.

---

## AŞAMA 4: YORUMLA

### Başarılıysa

```
✓ Testler geçti
  - Unit: 23/23 passed
  - Süre: 4.2s
  - Coverage: 78% (lines)
```

### Başarısızsa

Her fail eden test'i listele, **ilk 3'ü** için analiz yap:

```
✗ 2 test fail oldu

FAIL #1: auth.service.spec.ts > "should hash password"
  Expected: hash.length > 40
  Received: 32

  Analiz: bcrypt hash uzunluğu 60 karakter olmalı.
  Muhtemel: "saltRounds" eksik veya algorithm değişti.
  Dosya: src/modules/auth/auth.service.ts:45

FAIL #2: ...
```

### Stack trace'in ilk satırını oku

Tipik pattern'lar:
- `TypeError: Cannot read property 'X' of undefined` → null check eksik
- `Timeout - Async callback was not invoked` → await eksik veya promise done() olmuyor
- `Expected X to equal Y` → mantık hatası

---

## AŞAMA 5: RAPORLA

Başarılıysa:
```
✓ /test smoke → geçti (5.1s)
```

Başarısızsa:
```
✗ /test unit → 2/23 fail

Öneriler:
1. auth.service.spec.ts:45 → bcrypt saltRounds fix
2. user.controller.spec.ts:120 → mock setup eksik

Düzeltme isteğiyle: /build <modül> veya direkt talimat ver.
```

---

## Coverage için özel davranış

`/test coverage` çalıştırıldığında:

1. Coverage raporu oluştur (`--coverage` flag)
2. `coverage/coverage-summary.json` oku
3. **Eksik testleri bul** — hangi dosyaların coverage'ı düşük:

```
Coverage: 68% (hedef: 80%)

Düşük coverage'lı dosyalar:
- src/modules/auth/auth.guard.ts — 45% (eksik: yetkisiz durum)
- src/utils/hash.ts — 20% (hiç test yok)

Test yazılacak mı? /build ile test dosyası eklenebilir.
```

---

## YAPMA

- **Tüm output'u göster.** Context patlar. `tail -N` ile kırp.
- **Test'i üç kez arka arkaya çalıştırma.** Flaky test varsa kullanıcıya söyle.
- **Fail olan test'i "dummy'lemek" için kod değiştir.** Test fail ise düzeltilecek üretim kodu değil, test'i bozan mantık hatası.
- **`--force` veya `--bail` flag'leri otomatik ekleme.** Açıkça istenirse ekle.
- **CI'da çalıştırılacak gibi full run yapma** (80dk süren e2e suite). Gerekmiyorsa kısa tur.
