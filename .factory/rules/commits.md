---
severity: must
---

# Commit Kuralları

## Conventional Commits

**MUST** format:
```
<tip>(<scope>): <özet>

[opsiyonel gövde]

[opsiyonel footer]
```

## Tipler

| Tip | Ne Zaman |
|-----|----------|
| `feat` | Yeni feature |
| `fix` | Bug düzelmesi |
| `docs` | Sadece doküman |
| `style` | Formatting, semicolon, boşluk (mantık değişmedi) |
| `refactor` | Kod düzenleme (davranış değişmedi) |
| `perf` | Performans iyileştirmesi |
| `test` | Test eklendi/düzenlendi |
| `chore` | Build, tool, paket update |
| `ci` | CI/CD config değişimi |
| `revert` | Önceki commit'i geri al |

## Scope

Opsiyonel ama **tavsiye edilir**. Modül/alan ismi:
- `feat(auth): add refresh token endpoint`
- `fix(profile): avatar upload size limit`
- `chore(deps): bump axios to 1.6.2`

## Özet

**MUST**
- İmperatif mood: "add" değil "added" değil "adds" (present imperative)
- Küçük harf (proper noun hariç)
- Nokta yok
- Max 72 karakter

İyi:
```
feat(users): add password reset flow
fix(orders): prevent duplicate submission on slow network
docs(api): document rate limit headers
```

Kötü:
```
Added password reset flow.        ← past tense + nokta
Users: password reset              ← tip yok
feat(users): Add Password Reset.  ← büyük harf + nokta
WIP                                ← ne?
.                                  ← boş
fix bug                            ← hangi bug?
```

## Gövde (opsiyonel ama önerilir)

Yapılan değişikliğin **nedeni** burada:

```
feat(auth): add refresh token endpoint

JWT access token'lar kısa ömürlü olmaya çekildi (15dk).
Refresh flow eklenmezse kullanıcı 15 dakikada bir login
olmak zorunda kalır. Bu PR refresh endpoint'i ile
re-authentication'sız session uzatmayı mümkün kılar.

Closes AUTH-42
```

## Footer

**MUST** şu durumlarda:

### Breaking change
```
feat(api): reshape user response schema

BREAKING CHANGE: User DTO'da `name` field'i `fullName`
olarak değişti. Frontend'in güncellenmesi gerekir.
```

MAJOR semver bump gerektirir.

### Ticket ref
```
fix(orders): handle concurrent checkout race condition

Closes #142
Refs ACME-89
```

## Atomiklik

**MUST**
- Tek commit → tek mantıksal değişim
- "feat + fix + refactor" karışık commit yasak

**SHOULD**
- 10 dosya değişmişse muhtemelen 3 commit gerek
- `git add -p` ile hunk bazlı staging

## Push öncesi

**MUST**
- Testleri çalıştır (`/test smoke` min.)
- Sensitive data (password, key) commit edilmemiş

**SHOULD**
- Rebase ile main'den güncel al (`git pull --rebase origin main`)
- Commit'leri gözden geçir (`git log --oneline`)

## Aksiyon

`/build` sonunda commit için:
1. Sadece ilgili dosyaları stage et
2. Yapılan değişikliğin özünü tek cümlede düşün
3. Tip + scope + özet
4. Büyük değişimse gövde + footer
5. Testleri çalıştır, geçtiyse commit

```bash
# örnek akış
git status                                    # ne değişti
git add src/modules/auth/ test/auth.spec.ts  # sadece ilgili
git diff --cached                             # ne commit edilecek, son kontrol
git commit -m "feat(auth): add refresh token endpoint"
```
