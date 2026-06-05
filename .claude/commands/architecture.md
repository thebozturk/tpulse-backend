# /architecture — Mimari kontrol ve refactor

Argument: `<subcommand>` — `review [path]` | `refactor <pattern> [path]` | `audit`

Context bütçesi: 15k token

## Subcommands

### `/architecture review [path]`

Mimari incelemesi. Path verilirse o klasör/dosya, verilmezse `src/` (backend) veya `app/`+`components/` (frontend).

```
1. architecture-reviewer agent'ını çağır
2. Agent 6 boyutta tarar: layer / SOLID / pattern / DI / anti-pattern / refactor
3. Severity-grouped rapor üretir
4. Kullanıcı önceliklerine göre refactor sırasını seçer
```

### `/architecture refactor <pattern> [path]`

Mevcut kodu hedef pattern'a refactor eder.

Desteklenen pattern'lar:
- `strategy` — if/else zinciri → Strategy + Factory
- `repository` — direct Prisma/Mongoose usage → Repository interface
- `factory` — manual `new` ile yaratımı → Factory pattern
- `di` — `new ConcreteX()` → constructor injection
- `service-extract` — Controller'daki business logic → Service'e taşı

```
Workflow:
1. Read shared/.factory/skills/patterns/<pattern>.md
2. Hedef path'teki kodu oku
3. Refactor planı çıkar (etkilenen dosyalar + yeni dosyalar)
4. Kullanıcıya plan göster, ONAY iste
5. Onay sonrası uygula:
   - Yeni dosyaları oluştur
   - Mevcut dosyaları güncelle
   - DI container'ı update et
   - Test stub'ı oluştur (varsa)
6. Verify: tsc --noEmit + test
```

### `/architecture audit`

Tüm projede anti-pattern envanteri.

```
1. shared/.factory/skills/patterns/anti-patterns.md oku
2. 15 anti-pattern için grep tarama yap
3. Her hit için: file:line + severity + skill ref
4. Severity'ye göre grupla, count rapor et
5. Top 5 öneri sırası
```

Çıktı:
```
=== Architecture Audit ===

🔴 Kritik (3 hit):
- [ANTI-1] Controller'da if(featureFlag): src/chats/chats.controller.ts:42
- [ANTI-13] Ownership eksik: src/orders/orders.repository.ts:18
- [ANTI-11] .env commit'lenmiş: tracking diff:abc123

🟡 Önemli (8 hit):
- [ANTI-3] Repository'de business logic: 3 dosya
- [ANTI-5] Validation controller'da: 2 dosya
- [ANTI-8] console.log mix: 3 dosya

Top 3 öneri:
1. /architecture refactor service-extract src/orders/orders.controller.ts
2. .env'i remove from history (BFG repo-cleaner)
3. /architecture refactor strategy src/chats/chats.controller.ts
```

## Stack-aware

`.factory/memory/conventions.json` → `stack.framework` ve `stack.orm` okunur.

- NestJS + Prisma → `prisma/` + `architecture/` skill'leri
- NestJS + Mongoose → `mongodb/` + `architecture/` skill'leri
- Next.js → `frontend/architecture/` + `react/` skill'leri

## Skill'lerin önceliği

Her review/refactor öncesi sırayla:
1. `shared/.factory/skills/patterns/INDEX.md`
2. İlgili pattern dosyası (`strategy.md`, `repository.md` vs.)
3. `shared/.factory/skills/patterns/anti-patterns.md`
4. Stack-spesifik `architecture/` (backend için `feature-flags.md`, vs.)

## Output disiplini

```
ŞİMDİ:
<problematic kod, line numbers ile>

REFACTOR (somut adımlar):
1. ...
2. ...

Etkilenen dosyalar:
- yeni: <list>
- değişen: <list>

Skill ref:
- patterns/<x>.md

Sonraki:
- Test/verify komutu
- Olası diğer refactor adımları
```

## Yapma

- Tüm projeyi tek seferde refactor etmek — incremental, dosya bazlı
- Sadece "kötü" demek — somut kod örneği + dosya listesi şart
- Pattern'ı zorla uygulamak — context'e uygun değilse alternatifi de söyle
- Test verify atlamak — refactor sonrası `tsc --noEmit` ZORUNLU
- DI container'ı update etmemek — yeni provider'lar eklenirse container'a yansıt
- Skill referanslarını es geçmek — kullanıcı kaynağa gitmek isteyebilir
- 15 anti-pattern'ı tek seferde fixletmek — top 3 yeter

## Örnek session

```
User: /architecture review src/chats

Claude: [architecture-reviewer agent invoke]
        chats/ klasörünü 6 boyutta inceledim:

        🔴 Kritik:
        1. ChatController.complete() — if (flags.STREAMING_ENABLED) controller'da
           Refactor: Strategy + Factory pattern
        2. ChatRepository.findById(id) — userId yok (ownership)

        🟡 Önemli:
        - Service'de inline DTO mapping (3 yerde tekrar)

        Önerilen sıra:
        1. /architecture refactor service-extract — ownership fix
        2. /architecture refactor strategy — completion strategy

User: /architecture refactor strategy src/chats

Claude: Read patterns/strategy.md + factory.md
        Plan:
        - YENI: src/chats/strategies/completion.strategy.ts (interface)
        - YENI: src/chats/strategies/streaming-completion.strategy.ts
        - YENI: src/chats/strategies/json-completion.strategy.ts
        - YENI: src/chats/strategies/completion.factory.ts
        - DEĞİŞİR: src/chats/chats.service.ts (factory.create())
        - DEĞİŞİR: src/chats/chats.controller.ts (3 satıra)
        - DEĞİŞİR: src/di-container.ts

        Onay verir misin? [y/N]

User: y

Claude: [Dosyaları oluşturur ve günceller]
        ✓ Refactor tamam
        ✓ tsc --noEmit pass
        ✓ Test stub oluşturuldu: completion.factory.spec.ts

        Sonraki: ownership fix için /architecture refactor service-extract
```
