# /improve — Self-Learning: Hatalardan Kalıcı Kural

$ARGUMENTS: Opsiyonel. `show` → sadece pattern'ları göster, kural oluşturma. Default: interaktif.

## Amaç

`error-log.jsonl`'i analiz et, 3+ kez tekrarlayan hata pattern'larını bul, kullanıcı onayıyla `.factory/rules/learned/` altına kalıcı kural dosyası yaz. Bu sayede agent aynı hatayı tekrar yapmaz.

## Protocol

1. **ANALİZ** — Error log'u oku, pattern'ları say
2. **SEÇ** — 3+ kez tekrarlayanları listele
3. **ONAYLA** — Kullanıcı hangilerinin kalıcı kural olacağını seçer
4. **YAZ** — `rules/learned/<pattern-adi>.md` oluştur
5. **CLEAR** — İşlenmiş error log entry'lerini işaretle

## Context Bütçesi: Max 10k token

---

## AŞAMA 1: ANALİZ

`.factory/memory/error-log.jsonl`'i oku. Her satır bir JSON event:

```jsonl
{"ts":"2025-04-20","pattern":"any-type","file":"auth.service.ts","module":"auth"}
{"ts":"2025-04-20","pattern":"console-log","file":"user.controller.ts","module":"users"}
{"ts":"2025-04-21","pattern":"any-type","file":"profile.service.ts","module":"profile"}
```

Pattern'ları say:

```bash
cat .factory/memory/error-log.jsonl | \
  grep -oE '"pattern":"[^"]*"' | \
  sort | uniq -c | sort -rn
```

---

## AŞAMA 2: SEÇ

3+ kez tekrarlayan pattern'ları göster:

```
Tekrarlayan hata pattern'ları (3+):

1. any-type (7 kez)
   Son görüldüğü dosyalar:
   - auth.service.ts
   - profile.service.ts
   - notification.service.ts

2. console-log (5 kez)
   - user.controller.ts
   - auth.service.ts
   - ...

3. missing-await (4 kez)
   - order.service.ts
   - payment.service.ts

Hangisini kalıcı kural yapalım? (1, 2, 3, hepsi, none)
```

---

## AŞAMA 3: ONAYLA

Kullanıcı seçimini belirtir. Örn: "1 ve 3".

Her seçim için iyi/kötü örnek üret:

```
any-type için kural tasarlıyorum:

Kötü örnek (senin kodundan):
  function processUser(data: any) { ... }

İyi örnek (önereceğim):
  function processUser(data: UserData) { ... }
  // veya
  function processUser<T extends BaseData>(data: T) { ... }

Bu örnekler uygun mu? Ekleme/çıkarma var mı?
```

---

## AŞAMA 4: YAZ

`.factory/rules/learned/<pattern>.md` oluştur:

```markdown
---
source: self-learned
pattern: any-type
occurrences: 7
first_seen: 2025-04-15
last_seen: 2025-04-21
files_seen: 7
---

# `any` Type Kullanma

## Ne zaman tetiklenir
TypeScript dosyasında `: any` type annotation'ı görüldüğünde.

## Neden yanlış
- Type safety'yi bypass eder
- Auto-complete ve refactor desteği kaybolur
- Runtime hatalara davetiye çıkarır

## Kötü
```typescript
function processUser(data: any) {
  return data.name.toUpperCase();
}
```

## İyi
```typescript
interface UserData {
  name: string;
}

function processUser(data: UserData) {
  return data.name.toUpperCase();
}
```

## Alternatifler
- Bilinmeyen type için: `unknown` (type guard ile daralt)
- Generic: `<T>` ile şablon
- Zod runtime validation için

## İstisna
Eğer gerçekten gerekliyse eslint-disable comment bırak:
```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lib: any = require('untyped-lib');
```
```

---

## AŞAMA 5: CLEAR

`error-log.jsonl`'in işlenmiş olduğunu işaretle. İki yaklaşım:

### Yaklaşım A: Full rotate (basit)

```bash
mv .factory/memory/error-log.jsonl .factory/memory/error-log.archived.jsonl
touch .factory/memory/error-log.jsonl
```

Archive dosyası git'e gitmez (.gitignore'da). Yeni log başlar.

### Yaklaşım B: Sadece işlenmiş pattern'ları sil (hassas)

```bash
grep -v '"pattern":"any-type"' .factory/memory/error-log.jsonl > /tmp/log.tmp
mv /tmp/log.tmp .factory/memory/error-log.jsonl
```

Diğer pattern'lar korunur, sayım sıfırlanmaz.

**Tercih: Yaklaşım B** — daha hassas, diğer pattern'ların sayımı kaybolmaz.

---

## Raporla

```
✓ /improve tamamlandı

2 kalıcı kural oluşturuldu:
- .factory/rules/learned/no-any-type.md
- .factory/rules/learned/missing-await.md

Bu kurallar enrich-prompt tarafından otomatik enjekte edilir.
Agent artık bu hataları tekrar yapmayacak.

Sonraki session'da: session-start bu kuralları hatırlatır.
```

---

## YAPMA

- **Tek tek her hata için kural oluşturma.** 3+ kuralı zorunlu.
- **Onaysız yaz.** Kullanıcı onaylamadığı pattern için dosya oluşturma.
- **Çok uzun rule dosyası yaz.** Max 30-40 satır. Kısa, öz, copy-paste örnek.
- **Eski archive'ları siliyor ol.** `error-log.archived.jsonl` git'e gitmez ama lokal'de tutulsun — geçmişe bakmak faydalı.
- **Kural overlap etsin.** Aynı konu için iki kural yazma. Mevcut kuralı genişlet.

---

## `$ARGUMENTS = show` ayrı mod

Sadece pattern'ları göster, kural oluşturma:

```
$ /improve show

Son 30 günde tekrarlayan hatalar:
- any-type: 7 kez
- console-log: 5 kez
- missing-await: 4 kez
- inline-function-in-render: 3 kez
- ...

Kural oluşturmak için: /improve
```
