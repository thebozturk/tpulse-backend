---
name: prisma-setup
keywords: "prisma, setup, install, NestJS, provider"
description: "Prisma kurulum, NestJS PrismaService, env config"
---

# Prisma Setup (NestJS + PostgreSQL)

## Install

```bash
pnpm add @prisma/client
pnpm add -D prisma
npx prisma init
```

`prisma init`:
- `prisma/schema.prisma` oluşturur
- `.env`'e `DATABASE_URL` ekler

## .env

```bash
DATABASE_URL="postgresql://user:pass@localhost:5432/dbname?schema=public"

# Production tip — connection pooling için pgBouncer URL
# DATABASE_URL="postgresql://user:pass@bouncer.acme.com:6432/dbname?pgbouncer=true&connection_limit=1"
```

zod env validation:
```typescript
// src/config/env.ts
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url().startsWith("postgresql://"),
});

export const env = envSchema.parse(process.env);
```

## schema.prisma — base config

```prisma
generator client {
  provider = "prisma-client-js"
  // Önerilen — daha optimize binary
  // previewFeatures = ["fullTextSearch", "fullTextIndex"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  // Connection pool şema migration'da optional
  // shadowDatabaseUrl = env("SHADOW_DATABASE_URL")
}
```

## NestJS PrismaService (singleton)

```typescript
// src/prisma/prisma.service.ts
import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from "@nestjs/common";
import { PrismaClient, Prisma } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: "event", level: "query" },
        { emit: "event", level: "warn" },
        { emit: "event", level: "error" },
      ],
      errorFormat: "pretty",
    });

    if (process.env.NODE_ENV !== "production") {
      // @ts-expect-error - Prisma typing on event
      this.$on("query", (e: Prisma.QueryEvent) => {
        if (e.duration > 100) {
          this.logger.warn(`Slow query (${e.duration}ms): ${e.query}`);
        }
      });
    }

    // @ts-expect-error
    this.$on("error", (e) => this.logger.error(e));
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  // Test cleanup helper
  async cleanDatabase() {
    if (process.env.NODE_ENV === "production") {
      throw new Error("cleanDatabase production'da çağrılamaz");
    }

    const tablenames = await this.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname='public'
    `;

    for (const { tablename } of tablenames) {
      if (tablename !== "_prisma_migrations") {
        try {
          await this.$executeRawUnsafe(`TRUNCATE TABLE "public"."${tablename}" CASCADE;`);
        } catch (e) {
          this.logger.error(`Failed to truncate ${tablename}`, e);
        }
      }
    }
  }
}
```

## Module

```typescript
// src/prisma/prisma.module.ts
import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

`@Global()` — her module otomatik inject eder.

## Service kullanım

```typescript
// src/users/users.service.ts
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma, User } from "@prisma/client";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(args?: Prisma.UserFindManyArgs): Promise<User[]> {
    return this.prisma.user.findMany(args);
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.prisma.user.update({ where: { id }, data });
  }

  async delete(id: string): Promise<User> {
    return this.prisma.user.delete({ where: { id } });
  }
}
```

## Generate (build pipeline)

```bash
# Schema değiştirdiğinde
npx prisma generate

# CI/build script'lere ekle
"prebuild": "prisma generate"
```

`@prisma/client` runtime'da generated kod kullanır — generate olmadan çalışmaz.

## Docker

```dockerfile
# Dockerfile
COPY prisma ./prisma
RUN npx prisma generate

# Multi-stage build:
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN pnpm install
RUN npx prisma generate

FROM node:20-alpine AS runner
COPY --from=deps /app/node_modules ./node_modules
# ...
```

## docker-compose.yml — Postgres dev

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev
      POSTGRES_DB: app_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dev"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres-data:
```

## Aksiyon

1. `pnpm add @prisma/client && pnpm add -D prisma`
2. `npx prisma init` — `.env` + `schema.prisma`
3. `PrismaService` (extends PrismaClient, OnModuleInit/Destroy)
4. `@Global() PrismaModule`
5. `prisma generate` build pipeline'da (prebuild)
6. Postgres container docker-compose'da
7. zod env validation `DATABASE_URL`
