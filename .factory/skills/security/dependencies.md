---
name: security-dependencies
keywords: "dependency, npm audit, snyk, dependabot, vulnerability, CVE"
description: "Dependency vulnerability management"
---

# Dependencies

## Risk

`pnpm install` → projenin transitive bağımlılıkları binlerce paket. Birinde CVE varsa exploitable.

2024 örnekleri: `xz-utils` backdoor, `lodash` prototype pollution, `axios` SSRF.

## Audit komutları

### npm/pnpm audit
```bash
pnpm audit --audit-level=high
# Çıktı: kritik vulnerability'ler

# Otomatik fix (patch versiyonu varsa)
pnpm audit fix

# Major bump dahil (breaking olabilir, dikkatli)
pnpm audit fix --force
```

### Snyk
```bash
pnpm add -D snyk
npx snyk test
npx snyk monitor  # background monitoring
```

Daha kapsamlı: license check, dev dep dahil, fix önerisi PR'ı açar.

### Trivy (image scan)

Docker image içinde de bağımlılık vulnerabilities:
```bash
trivy image acme/backend:latest
```

CI'da otomatik.

## CI integration

```yaml
# .github/workflows/security.yml
name: Security

on:
  pull_request:
  schedule:
    - cron: '0 0 * * *'  # daily

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install --frozen-lockfile
      - run: pnpm audit --audit-level=high
        # Critical varsa fail

  snyk:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high

  trivy:
    runs-on: ubuntu-latest
    steps:
      - uses: aquasecurity/trivy-action@master
        with:
          image-ref: 'acme/backend:${{ github.sha }}'
          severity: 'CRITICAL,HIGH'
          exit-code: '1'
```

CI fail → PR merge bloklanır.

## Dependabot

GitHub native:

`.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: 'npm'
    directory: '/'
    schedule:
      interval: 'weekly'
      day: 'monday'
    open-pull-requests-limit: 5
    groups:
      dev-deps:
        dependency-type: 'development'
      prod-patches:
        dependency-type: 'production'
        update-types: ['patch']

  - package-ecosystem: 'docker'
    directory: '/'
    schedule:
      interval: 'weekly'

  - package-ecosystem: 'github-actions'
    directory: '/.github/workflows'
    schedule:
      interval: 'monthly'
```

Her hafta dependency PR'ları otomatik açar.

## Renovate (alternatif)

Daha esnek:
```json
// renovate.json
{
  "extends": ["config:base"],
  "schedule": ["after 9pm and before 6am every weekday"],
  "packageRules": [
    {
      "matchUpdateTypes": ["minor", "patch"],
      "automerge": true
    }
  ]
}
```

Patch ve minor otomatik merge (testler yeşilse).

## Lockfile zorunlu

```bash
pnpm install --frozen-lockfile  # CI'da
```

Lockfile değişimi PR review'ında — yeni dep'in kim eklediği görünür.

## Allowlist

Bazen vulnerability bilinçli kabul edilir (false positive, etki yok):
```json
// .snyk
ignore:
  SNYK-JS-AXIOS-6032459:
    - '*':
        reason: 'Not exploitable in our usage'
        expires: '2026-12-31T00:00:00.000Z'
```

Expiry zorunlu — sonsuz ignore yok.

## SBOM (Software Bill of Materials)

Production build'de hangi dep'ler var, audit için:
```bash
npx @cyclonedx/cyclonedx-npm --output sbom.json
```

CycloneDX veya SPDX format. Compliance (SOC 2, ISO 27001) gerektirir.

## License compliance

GPL içeren dep production'da kullanma (proprietary code mu olacak?):
```bash
npx license-checker --production --summary
```

Allowlist:
- MIT, ISC, BSD, Apache-2.0 — OK
- GPL, AGPL — review

## Outdated check

```bash
pnpm outdated
# Hangi paket güncellenebilir?
```

Major bump'ları PR ile test:
```bash
pnpm up <pkg> --latest
```

Breaking change varsa changelog'u oku.

## Trust policy

Yeni dep eklemeden önce kontrol:
- Maintainer kim? Aktif mi?
- Kaç indirme? (npm trends)
- Son commit ne zaman?
- Issue/PR backlog
- Security audit hikayesi

Microscopic dep'ler (`is-odd`) tehlikeli — supply chain attack vektörü. Stdlib veya proven library tercih.

## Bot dependencies

Build için kullanılan dep'ler (eslint plugin, vs.) dev dependencies'e:
```json
{
  "dependencies": { /* runtime */ },
  "devDependencies": { /* build/test */ }
}
```

Production image'a dev dep gitmez (Multi-stage Dockerfile).

## Anti-pattern'ler

### Audit fail görmezden gel
```bash
pnpm install  # CI yeşil, ama audit fail var
```

### `--force` her zaman
```bash
pnpm audit fix --force
```
Major bump'lar breaking. Test gerek.

### Lockfile'ı ignore
```
.gitignore: pnpm-lock.yaml  # ❌
```
Lockfile committed olmalı.

### Latest tag image
```dockerfile
FROM node:latest  # ❌ reproducibility yok
```

### Unmaintained dep
2 yıl önce son commit + 3 open security issue → değiştir.

## Aksiyon

1. CI'da `pnpm audit --audit-level=high`
2. Dependabot/Renovate kurulu
3. Critical CVE → PR merge bloklu
4. Snyk veya benzer tool
5. Trivy ile image scan
6. SBOM generation
7. License check (GPL alarm)
8. Lockfile commit + frozen-lockfile CI
9. Yeni dep ekleme → trust check
