---
name: devops-dockerfile
keywords: "docker, dockerfile, multi-stage, non-root, alpine"
description: "Production-grade Dockerfile"
---

# Dockerfile

Bkz. `.claude/rules/docker.md` kurallar.

## Multi-stage template

```dockerfile
# syntax=docker/dockerfile:1.6
FROM node:20.11-alpine AS builder

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

COPY . .
RUN pnpm build
RUN pnpm prune --prod

FROM node:20.11-alpine AS runtime

RUN apk add --no-cache tini

WORKDIR /app

USER node

COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/package.json ./

ENV NODE_ENV=production
EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health/ready || exit 1

CMD ["node", "dist/main.js"]
```

## Size optimization

```bash
# Build
docker build -t acme/backend .

# Size check
docker images acme/backend
```

Hedef: <200MB. Node alpine tabanlı, multi-stage, prune prod → genellikle 150MB.

## Cache layer strategy

Her `COPY/RUN` bir layer. Değişen az olanı üstte:
```
1. FROM (nadir değişir)
2. COPY package.json (dep eklendiğinde değişir)
3. RUN install (dep değiştiyse yeniden)
4. COPY . (her code değişiminde yeni)
5. RUN build (her code değişiminde yeni)
```

`package.json` değişmediği sürece install cache'li.

## Aksiyon

- Multi-stage
- Non-root user
- tini init
- HEALTHCHECK
- <200MB hedef
