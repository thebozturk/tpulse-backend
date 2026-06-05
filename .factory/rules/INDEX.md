# Rules Index

Advisory kurallar — agent bunlara "böyle yapmalı" dediğini anlar. Hook'lar "bunu yapma" deyip engeller; kurallar aksine rehberlik eder.

## Ortak Kurallar (generic, tüm profile'lar)

- [coding-standards.md](coding-standards.md) — kod yazım standartları
- [commits.md](commits.md) — commit mesaj kuralları

## Profile-specific

Profile install edildiğinde eklenir. Örn. backend: `naming.md`, `api-conventions.md`.

## Öğrenilmiş Kurallar

`learned/` altında — `/improve` komutu ile oluşur. Update dokunmaz.

## Kural severity

Her kuralda bir severity olmalı:
- **MUST** — ihlal edilmez, hook engeller
- **SHOULD** — ihlal edilirse review'da warning
- **MAY** — öneri, tercihten ibaret

Kural dosyasının başında:
```yaml
---
severity: must | should | may
---
```
