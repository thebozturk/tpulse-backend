# /review — Kod Kalite İnceleme

$ARGUMENTS: Opsiyonlar: `quick` (hızlı tarama, 15k token), `deep` (tam inceleme, 25k token), `perf` (performans odaklı). Default: `quick`.

## Amaç

Kod kalitesini **başka bir gözle** denetle. `reviewer` agent'ını kullanarak — yazma yetkisi olmayan, sadece okuyup raporlayan — mevcut değişikliklerin sorunlarını bulur.

## Protocol

1. **KAPSAM** — Ne review edilecek (uncommitted, son commit, belirli dosya)
2. **DELEGE** — `reviewer` agent'a işi bırak
3. **RAPORLA** — Bulguları kategori bazlı göster
4. **ÖNER** — Düzeltme planı

## Context Bütçesi
- `quick`: 15k token
- `deep`: 25k token

---

## AŞAMA 1: KAPSAM

Kullanıcı bir dosya/klasör belirtmediyse sırayla kontrol et:

1. **Uncommitted değişiklikler** varsa onu review et:
   ```bash
   git diff HEAD --name-only
   ```

2. Yoksa **son commit**:
   ```bash
   git show --stat HEAD
   ```

3. Kullanıcı `$ARGUMENTS`'ta dosya/klasör verdiyse onu review et.

Kapsamı onayla:
```
Review kapsamı:
- 3 dosya (uncommitted)
  - src/modules/auth/auth.service.ts
  - src/modules/auth/auth.controller.ts
  - src/modules/auth/dto/login.dto.ts

Devam?
```

---

## AŞAMA 2: DELEGE

`reviewer` agent'ını çağır. Agent sadece `Read`, `Glob`, `Grep`, `Bash` tool'larına sahip — Write yok. Kodu değiştiremez.

Agent'a verilen bilgi:
- Review kapsamı (dosya listesi)
- Mode (`quick`/`deep`/`perf`)
- `.factory/memory/conventions.json`
- İlgili path-scoped rule'lar (api.md, auth.md etc.)

---

## AŞAMA 3: RAPORLA

Agent'ın çıktısını kategori bazlı göster:

```
REVIEW: src/modules/auth/*.ts

🔴 CRITICAL (2)
  auth.service.ts:45
    Hardcoded secret: JWT_SECRET_FALLBACK = 'dev-secret'
    → Prod'a gitmemeli. .env'den gelmezse throw etmeli.

  auth.controller.ts:78
    SQL injection riski (varsa ORM kullanımı):
    User.findOne({ where: { email: req.body.email } })
    → Input validation eksik, Zod/class-validator gerek.

🟡 WARNING (3)
  auth.service.ts:92
    console.log(user) — production logger yok
    → logger.info veya debug kullan.

  login.dto.ts:15
    email: string — @IsEmail() yok
    → class-validator decorator ekle.

  auth.service.ts:120
    async fonksiyon try/catch olmadan — rejection leak edebilir

ℹ️ INFO (5)
  - Naming: getUserByEmail vs findUserByEmail tutarsız (conv'a uygun değil)
  - Magic number: 3600 (JWT expiry) → const TOKEN_TTL = 3600
  - ...

ÖZET:
  🔴 2 critical — düzeltilmeli
  🟡 3 warning — düzeltmek iyi olur
  ℹ️ 5 info — opsiyonel
```

---

## Mode'lar

### `quick` (default)
- Sadece uncommitted veya son commit
- Critical + Warning kategorileri
- Info atlanır
- **Çıktı: 20-40 satır max**

### `deep`
- Tüm modülü veya verilen kapsam
- Tüm kategoriler
- Ayrıca:
  - Test coverage raporu
  - Dependency security (dış paket uyumsuzlukları)
  - Architectural concerns (abstraction eksik, single responsibility ihlali)
- **Çıktı: 60-100 satır**

### `perf`
- Performance odaklı
- N+1, memory leak, inefficient algorithms, caching opportunities
- Benchmarking önerileri
- **Çıktı: 30-50 satır**

---

## AŞAMA 4: ÖNER

Bulgular çoksa önceliklendir:

```
ÖNCELİK SIRASI (en kritikten):
1. auth.service.ts — JWT_SECRET fallback kaldır (5dk)
2. auth.controller.ts — input validation ekle (15dk)
3. login.dto.ts — @IsEmail() decorator (1dk)

Bunları düzeltmek için:
  /build auth-hardening

Veya manuel düzeltmek istiyorsan liste yukarıda.
```

---

## YAPMA

- **Kod değiştirme.** Review sadece rapor. Düzeltme için /build ile ayrı akış.
- **Tüm dosyaları oku.** `reviewer` agent zaten bunu dar context'le yapar. Main conversation'ın context'ini korumak için delege et.
- **Nitpick ağırlıklı liste çıkar.** Prensip: her maddeyi "bu olmasa ne olur?" filtresinden geçir. Olmazsa → kaldır.
- **Commit öncesi review'ı opsiyonel tut.** Kullanıcı istemedikçe dayatma.
- **Stil tartışmalarına gir.** "Tabs vs spaces" prettier kararı, review konusu değil.
