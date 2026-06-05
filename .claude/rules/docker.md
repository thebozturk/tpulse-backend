---
globs: "Dockerfile*,docker-compose*.yml,**/.dockerignore"
severity: must
---

# Docker Kuralları

`Dockerfile*`, `docker-compose*.yml`, `.dockerignore` dosyalarında aktif.

## MUST

- `FROM` satırında **tag locked** — `node:latest` yasak, `node:20.11-alpine` iyi
- Multi-stage build (prod image küçük olmalı, >200MB şüpheli)
- Non-root user: `USER node` veya custom user (root olarak çalıştırma)
- `HEALTHCHECK` tanımlı
- `.dockerignore` — `node_modules`, `.env`, `.git`, `dist`, `coverage` exclude

## SHOULD

- `node:20-alpine` tercih (küçük base)
- Production'da `NODE_ENV=production` + `npm ci --only=production`
- Cache layer'ları optimize: `package.json` önce COPY, dependency install, sonra source
- Build artifact sadece ihtiyacın olan (dist/, package.json, node_modules prod-only)
- Env variable'ları `ARG` ile değil `ENV` ile (build-time vs runtime)
- Secret'ları `ARG`'a geçirme (image'ta kalır — `docker history` ile okunur)

## ASLA

- `FROM node:latest` (reproducibility yok)
- Root user ile production
- HEALTHCHECK yok
- Secret'ı `ENV` olarak image'a göm (`ENV JWT_SECRET=...`)
- `.env` dosyasını `COPY` ile image'a al
- Single-stage build (geliştirme araçları prod image'a sızar)
- `RUN apt-get update && apt-get install ...` cache temizliği olmadan
- Full `node_modules` dev dependencies ile prod'a gönder

## Örnekler

### İyi — Multi-stage Dockerfile
```dockerfile
# syntax=docker/dockerfile:1.6

# ─── Builder ──────────────────────────────────────────
FROM node:20.11-alpine AS builder

WORKDIR /app

# Cache dependency layer
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm install --frozen-lockfile

# Source
COPY . .
RUN pnpm build
RUN pnpm prune --prod

# ─── Runtime ──────────────────────────────────────────
FROM node:20.11-alpine AS runtime

# Küçük image için curl yok — healthcheck için wget
RUN apk add --no-cache tini

WORKDIR /app

# Non-root user
USER node

# Sadece prod artifact
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/package.json ./

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# tini — proper signal handling (SIGTERM → graceful shutdown)
ENTRYPOINT ["/sbin/tini", "--"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/main.js"]
```

### İyi — docker-compose.yml
```yaml
services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile
    image: acme/backend:${TAG:-latest}
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - JWT_SECRET=${JWT_SECRET}
      - REDIS_URL=redis://redis:6379
    depends_on:
      mongo:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 15s
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '1.0'

  mongo:
    image: mongo:7.0
    restart: unless-stopped
    command: ["--replSet", "rs0", "--bind_ip_all"]
    volumes:
      - mongo-data:/data/db
    healthcheck:
      test: |
        mongosh --quiet --eval "try { rs.status() } catch(e) { rs.initiate() }"
      interval: 10s
      timeout: 10s
      retries: 5

  redis:
    image: redis:7.2-alpine
    restart: unless-stopped
    command: ["redis-server", "--appendonly", "yes", "--requirepass", "${REDIS_PASSWORD}"]
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3

volumes:
  mongo-data:
  redis-data:
```

### İyi — .dockerignore
```
.git
.gitignore
node_modules
dist
coverage
.env
.env.*
!.env.example
*.md
!README.md
.vscode
.idea
.factory
.claude
Dockerfile*
docker-compose*
```

### Kötü
```dockerfile
# ❌ latest tag
FROM node:latest

WORKDIR /app

# ❌ Secret image'a kalır
ENV JWT_SECRET=prod-secret-value

# ❌ Tüm dosyalar (gereksiz hepsi image'a)
COPY . .

# ❌ Dev dependencies dahil
RUN npm install

# ❌ HEALTHCHECK yok

# ❌ Root user
CMD ["node", "src/main.js"]
```

## Docker compose dev overlay

Prod compose dokunulmaz. Dev için `docker-compose.dev.yml` overlay:

```yaml
# docker-compose.dev.yml
services:
  backend:
    build:
      dockerfile: Dockerfile.dev
    volumes:
      - ./src:/app/src       # hot reload
      - ./test:/app/test
    environment:
      - NODE_ENV=development
    ports:
      - "3000:3000"
      - "9229:9229"          # debugger
```

Çalıştır: `docker compose -f docker-compose.yml -f docker-compose.dev.yml up`

## Security-gate etkileşimi

- `FROM node:latest` → warning
- `USER root` veya USER yok → warning
- `ENV JWT_SECRET=...` (gerçek value) → BLOCK
- `COPY .env ...` → BLOCK
