---
name: devops-compose
keywords: "docker compose, dev, prod, overlay"
description: "docker-compose — dev + prod ayrımı"
---

# Docker Compose

## Base + overlay

### docker-compose.yml (prod-like)
```yaml
services:
  backend:
    image: acme/backend:${TAG:-latest}
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - JWT_SECRET=${JWT_SECRET}
      - REDIS_URL=redis://redis:6379
    depends_on:
      mongo: { condition: service_healthy }
      redis: { condition: service_healthy }
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000/health/ready"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 20s
    deploy:
      resources:
        limits: { memory: 512M, cpus: '1.0' }

  mongo:
    image: mongo:7.0
    restart: unless-stopped
    command: ["--replSet", "rs0", "--bind_ip_all"]
    volumes: [mongo-data:/data/db]
    healthcheck:
      test: |
        mongosh --quiet --eval "try { rs.status().ok } catch(e) { rs.initiate().ok }"
      interval: 10s
      start_period: 30s

  redis:
    image: redis:7.2-alpine
    restart: unless-stopped
    command: ["redis-server", "--appendonly", "yes"]
    volumes: [redis-data:/data]
    healthcheck: { test: ["CMD", "redis-cli", "ping"], interval: 10s }

volumes:
  mongo-data:
  redis-data:
```

### docker-compose.dev.yml (overlay)
```yaml
services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile.dev
    volumes:
      - ./src:/app/src
      - ./test:/app/test
    environment:
      - NODE_ENV=development
    ports:
      - "3000:3000"
      - "9229:9229"  # debugger
    command: pnpm start:dev
```

### Çalıştırma
```bash
# Dev
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# Prod-like (staging)
docker compose up -d
```

## Aksiyon

- Base + overlay pattern
- Health check bağımlılıklara
- Volume persistent
- Resource limits
