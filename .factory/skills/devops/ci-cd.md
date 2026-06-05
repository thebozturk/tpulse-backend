---
name: devops-ci-cd
keywords: "CI, CD, github actions, pipeline, test, deploy"
description: "GitHub Actions pipeline"
---

# CI/CD

## PR pipeline

```yaml
# .github/workflows/pr.yml
name: PR

on:
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm tsc --noEmit

  test:
    runs-on: ubuntu-latest
    services:
      mongo:
        image: mongo:7.0
        ports: [27017:27017]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install --frozen-lockfile
      - run: pnpm test --coverage
      - uses: codecov/codecov-action@v4

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: gitleaks/gitleaks-action@v2
      - run: pnpm audit --audit-level=high

  build:
    needs: [lint, test, security]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker build -t acme/backend:pr-${{ github.event.pull_request.number }} .
```

## Main → deploy

```yaml
# .github/workflows/deploy.yml
on:
  push:
    branches: [main]
    tags: ['v*']

jobs:
  test:
    # same as PR

  build-push:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            ghcr.io/acme/backend:${{ github.sha }}
            ghcr.io/acme/backend:latest

  deploy-staging:
    needs: build-push
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - run: |
          # kubectl veya ansible
          kubectl set image deployment/backend backend=ghcr.io/acme/backend:${{ github.sha }}

  deploy-prod:
    if: startsWith(github.ref, 'refs/tags/v')
    needs: [deploy-staging]
    runs-on: ubuntu-latest
    environment: production  # manuel approval required
    steps:
      - run: kubectl set image deployment/backend backend=ghcr.io/acme/backend:${{ github.sha }}
```

## Secrets management

- Repository secrets: CI config
- Environment secrets: per-env (staging/prod)
- Required reviewers production environment'ta

## Aksiyon

- PR: lint + test + security
- Main: build + push + staging deploy
- Tag: production deploy (manuel approval)
- Secrets GitHub UI'dan
