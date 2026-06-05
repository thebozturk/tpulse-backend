---
name: git-flow
keywords: "git, branch, commit, merge, rebase, push, pull, PR, pull request"
description: "Branch ve commit disiplini"
---

# Git Flow

## Branch stratejisi

Factory korunan branch'lere commit engeli koyar (`protect-branch.sh`):
- `main`, `master`, `develop`, `production`, `staging`, `release/*` → bloklu

Her iş → feature branch:
```
feature/user-profile-avatar
fix/auth-token-expiry
chore/update-deps
docs/api-examples
```

İsim kuralı: `<tip>/<kısa-slug>`. Çok uzunsa jira/linear id: `feature/ACME-123-avatar`.

## Conventional commits

`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, `perf:`, `ci:`

Yapı: `<tip>(<scope>): <özet>`

İyi:
```
feat(profile): add avatar upload endpoint
fix(auth): prevent token reuse after logout
docs(api): update OpenAPI schemas
```

Kötü:
```
update stuff
fix bug
WIP
.
```

## Commit atomik olmalı

Tek commit → tek mantıksal değişim. Bir commit:
- Sadece feature ekliyor VEYA
- Sadece bug düzeltiyor VEYA
- Sadece refactor (behavior değişmez)

"10 dosya, 3 feature, 2 typo" = 6 ayrı commit.

Çok küçük parçala sonra `git rebase -i` ile squash → sonra push. Squash'ı push'tan önce yap, push'tan sonra hiç.

## PR / MR süreci

1. Feature branch'te çalış
2. Commit'ler atomik
3. Push öncesi `rebase origin/main` (merge commit değil, rebase)
4. PR aç — description: ne yapıyor, neden, nasıl test edildi
5. CI yeşil olmadan merge ASLA
6. Review sonrası squash merge veya rebase merge (takım kararı)

## Korunan branch'lere commit engeli

`protect-branch.sh` şu durumlarda `git commit`/`git push` komutunu bloklar:
- Current branch: `main`, `master`, `develop`, `production`, `staging`, `release/*`

Mesaj:
```
BLOCKED: 'main' branch'i korumalı. Feature branch'e çık:
  git checkout -b feature/<isim>
```

Bypass etmek istersen: hook'u geçici kapat veya manuel `git push --no-verify` (önerilmez).

## Uncommitted değişikliklerle branch değiştirme

Uncommitted kod varken `git checkout` yapma (conflict olabilir):

İyi:
```bash
git add -A && git commit -m "WIP: pause here"
git checkout feature/other
# iş bitti, geri dön
git checkout feature/original
git reset HEAD~1  # WIP commit'i uncommit yap
```

Veya `git stash` kullan:
```bash
git stash push -m "profile avatar WIP"
git checkout feature/other
# dön
git checkout feature/original
git stash pop
```

## Rebase vs merge

Feature branch'i main'e getirmek için:
- **Rebase (tercih):** `git pull --rebase origin main` — lineer history
- **Merge:** `git merge origin/main` — merge commit oluşur, history kirli

Takım karar alır; karışık kullanma.

## Anti-pattern'ler

**`git push --force`**
Feature branch'te kendi kullanımın için OK (rebase sonrası). Shared branch'e ASLA.

**"Son 5 commit'i tek commit yapayım" push'tan sonra**
Hayır. Push'tan önce squash, sonra asla.

**`git commit -am`**
Reflexive olarak `-a` → takip edilmeyen dosyalar atlanır. `git add -p` ile hangi hunk'ları aldığını gör.

**Merge commit'e `Merge branch 'main' into feature/...`**
Rebase ile önle. Çok gerekirse conflict çözümü commit'i ayrı.

## Aksiyon

Her `/build` sonunda:
1. Sadece ilgili dosyaları stage et: `git add <file> <file>`
2. Conventional commit mesajı
3. Test'ler geçtiyse commit
4. Push opsiyonel (PR için gerek varsa)

```bash
git add src/modules/profile-avatar/ test/profile-avatar.spec.ts
git commit -m "feat(profile): add avatar upload endpoint"
git push origin feature/user-profile-avatar
```
