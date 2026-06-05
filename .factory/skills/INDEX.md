# Skills Index

Factory'nin bilgi grafı. Agent tüm dosyaları okumaz — INDEX'ten alanına iner, alan INDEX'inden dosyaya.

## Workflow (generic — tüm projelerde aynı)

- [workflows/planning.md](workflows/planning.md) — Nasıl plan yapılır
- [workflows/decomposition.md](workflows/decomposition.md) — Büyük iş nasıl küçük parçalara bölünür
- [workflows/git-flow.md](workflows/git-flow.md) — Branch, commit, merge akışı

## Patterns (generic software design)

- [patterns/dependency-injection.md](patterns/dependency-injection.md) — DI kullanımı, container kararı
- [patterns/error-handling.md](patterns/error-handling.md) — Error'ları temiz yönetme
- [patterns/naming.md](patterns/naming.md) — Tutarlı isimlendirme

## Profile-specific (profile install edilince gelir)

Backend profile:
- `nestjs/`, `api/`, `mongodb/`, `auth/`, `security/`, `bot-defense/`, `resilience/`, `performance/`, `observability/`, `testing/`, `devops/`

Frontend profile:
- `next/`, `react/`, `state/`, `api/`, `forms/`, `styling/`, `a11y/`, `performance/`, `seo/`, `testing/`

## Third-party (kullanıcı ekler)

`third-party/` altına kullanıcının eklediği skill dosyaları — update dokunmaz.

## Ekleme Nasıl Yapılır

Yeni skill dosyası eklendiğinde YAML frontmatter kullan:

```yaml
---
name: skill-adi
keywords: "kw1, kw2, kw3"
description: "Tek satır açıklama"
---
```

Sonraki session'da `build-registry` bu dosyayı bulur, `enrich-prompt` prompt'ta keyword görürse otomatik referans verir.
