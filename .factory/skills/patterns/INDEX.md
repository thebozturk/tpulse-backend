# Architectural Patterns

Mimari disiplin skill'leri. Backend ve frontend tarafından paylaşılır — her iki profile'da da erişilebilir.

## Foundation

- [solid-principles.md](solid-principles.md) — SRP, OCP, LSP, ISP, DIP. Her birinin somut örneği ve ihlali.
- [layered-architecture.md](layered-architecture.md) — Route → Middleware → Controller → Service → Repository → DB hiyerarşisi, bağımlılık yönü kuralları.
- [naming.md](naming.md) — variable/function/class isimlendirme

## Patterns

- [singleton.md](singleton.md) — Ne zaman doğru (FF/Logger/Config/DB), ne zaman yanlış (Service/Repo). Global state tehlikesi.
- [repository.md](repository.md) — DB erişiminin soyutlanması, interface bazlı tasarım, business kuralı sınırı
- [service-layer.md](service-layer.md) — İş kurallarının konumu, HTTP'den habersiz olma kuralı, controller/service ayrımı
- [strategy.md](strategy.md) — Runtime davranış değişimi, if/else'in pattern'a dönüştürülmesi, OCP'nin canlandırması
- [factory.md](factory.md) — Strategy seçici, FF + factory bağlantısı, doğru nesneyi döndürme
- [dependency-injection.md](dependency-injection.md) — Constructor injection, manuel DI vs container, test mock

## Anti-patterns

- [anti-patterns.md](anti-patterns.md) — 15 yaygın tuzak: controller'da if(featureFlag), service'in res'e dokunması, repo'da business logic, singleton'ı her yerde, validation'ı controller'da, vs.

## Three architectural questions (her dosya yazılırken sor)

1. **"Bu kod hangi soruyu cevaplıyor?"** — birden fazla cevap → SRP ihlali, böl
2. **"Bu davranış değişimi nereden geliyor?"** — `if/else` ise Strategy pattern aday
3. **"Bu bağımlılık nereden geldi?"** — `new` ile yarattıysan DI ile dışarı çıkar

Bu üç soruya tutarlı cevap verirsen, sistem değiştirildiğinde kırılmaz.

## Pattern decision flowchart

```
Davranış değişimi var mı?
  ├─ HAYIR → düz fonksiyon yeter
  └─ EVET
     ├─ Compile-time'da seçilir mi? → polymorphism (TypeScript discriminated union)
     └─ Runtime'da seçilir mi? → Strategy pattern + Factory

Bağımlılık var mı?
  ├─ Tek instance gerek (DB pool, FF, Logger) → Singleton
  └─ Test mock'lanabilir olmalı → DI

Veri erişimi var mı?
  ├─ Tek yerden geliyor (DB) → Repository
  └─ Birden fazla kaynak (DB + cache + API) → Repository + facade
```
