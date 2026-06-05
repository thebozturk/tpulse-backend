# syntax=docker/dockerfile:1.6

# ─── Builder ──────────────────────────────────────────
FROM node:20.19-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

# Cache dependency layer
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Prisma client (schema gerekli)
COPY prisma ./prisma
RUN pnpm prisma generate

# Source + build
COPY . .
RUN pnpm build
RUN pnpm prune --prod

# ─── Runtime ──────────────────────────────────────────
FROM node:20.19-alpine AS runtime

RUN apk add --no-cache tini

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Non-root
USER node

COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/package.json ./

EXPOSE 8080

# tini — düzgün sinyal yönetimi (SIGTERM → graceful shutdown)
ENTRYPOINT ["/sbin/tini", "--"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

CMD ["node", "dist/main.js"]
