---
name: prisma-validation
keywords: "validation, zod, type-safe, runtime, dto"
description: "zod + Prisma — type-safe runtime validation"
---

# Prisma + zod

Prisma type-safe but **compile-time only**. Runtime input validation lazım.

## Pattern

```typescript
// src/users/dto/create-user.dto.ts
import { z } from "zod";
import { Prisma } from "@prisma/client";

export const createUserSchema = z.object({
  email: z.string().email().max(255),
  name: z.string().min(2).max(100),
  role: z.enum(["USER", "ADMIN", "MODERATOR"]).default("USER"),
}) satisfies z.ZodType<Prisma.UserCreateInput>;

export type CreateUserDto = z.infer<typeof createUserSchema>;
```

`satisfies z.ZodType<Prisma.UserCreateInput>` — schema, Prisma'nın expect ettiği shape ile compile-time uyumlu mu kontrol eder.

## NestJS pipe

```typescript
// src/common/pipes/zod-validation.pipe.ts
import { PipeTransform, BadRequestException } from "@nestjs/common";
import { ZodSchema, ZodError } from "zod";

export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Validation failed",
        details: result.error.flatten().fieldErrors,
      });
    }
    return result.data;
  }
}
```

## Controller

```typescript
@Post()
@UsePipes(new ZodValidationPipe(createUserSchema))
async create(@Body() dto: CreateUserDto): Promise<User> {
  return this.usersService.create(dto);
}
```

veya Body decorator level:

```typescript
@Post()
async create(
  @Body(new ZodValidationPipe(createUserSchema)) dto: CreateUserDto,
): Promise<User> {
  return this.usersService.create(dto);
}
```

## Update DTO (partial)

```typescript
export const updateUserSchema = createUserSchema.partial();
export type UpdateUserDto = z.infer<typeof updateUserSchema>;
```

`.partial()` — tüm field'ları optional yapar.

## prisma-zod-generator (auto)

Schema.prisma'dan zod schema'ları otomatik üret:

```bash
pnpm add -D zod-prisma-types
```

`schema.prisma`:
```prisma
generator zod {
  provider = "zod-prisma-types"
  output   = "../src/generated/zod"
}
```

```bash
npx prisma generate
```

Output:
```typescript
// src/generated/zod/UserSchema.ts
export const UserCreateInputSchema = z.object({
  email: z.string().email(),
  name: z.string().nullable(),
  role: z.enum(["USER", "ADMIN", "MODERATOR"]),
}) // ...

export const UserSchema = // ... full User model
```

Pro: schema değiştiğinde validation otomatik update.
Con: customization sınırlı (specific limit gibi).

## Hybrid pattern (recommended)

Auto-generated schema temel, manual extends UI-specific:

```typescript
import { UserCreateInputSchema } from "@/generated/zod";

// API'de gelen data
export const createUserApiSchema = UserCreateInputSchema.extend({
  password: z.string().min(8).max(100).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
  passwordConfirm: z.string(),
}).refine((data) => data.password === data.passwordConfirm, {
  message: "Şifreler eşleşmiyor",
  path: ["passwordConfirm"],
});

// Generated → DB-shape (no password — hashed before save)
// Manual extends → UI-shape
```

## Refinements

```typescript
const orderSchema = z.object({
  items: z.array(z.object({ productId: z.string(), quantity: z.number().int().positive() })),
  totalPrice: z.number().positive(),
}).refine(
  (data) => data.items.length > 0,
  { message: "En az 1 item olmalı", path: ["items"] },
);
```

## Async refinement (DB check)

```typescript
const emailUniqueSchema = z.string().email().refine(
  async (email) => {
    const existing = await prisma.user.findUnique({ where: { email } });
    return !existing;
  },
  { message: "Email zaten kullanımda" },
);

const createUserSchema = z.object({
  email: emailUniqueSchema,
  name: z.string(),
});

// safeParseAsync gerekli
const result = await createUserSchema.safeParseAsync(body);
```

Cost: extra DB query. Sadece truly unique check'lerde.

## Output validation (response)

API response shape'i validate:

```typescript
const userResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  // password explicitly omitted
});

@Get(":id")
async findOne(@Param("id") id: string): Promise<UserResponse> {
  const user = await this.usersService.findById(id);
  return userResponseSchema.parse(user);  // strip extra fields, validate
}
```

DTO'larda accidentally `password` gelmesin diye guarantee.

## Anti-pattern'ler

### class-validator + Prisma
NestJS default `class-validator`. Prisma + zod uyumu daha iyi:
- Prisma type-export, class değil
- zod inferType > class instance
- Functional > OOP for schema

class-validator hala kullanılır eski projede, yeni projede zod tercih.

### Validation client'a güven
```typescript
// ❌ Frontend zod var diye backend skip
@Post()
async create(@Body() dto: any) {
  return prisma.user.create({ data: dto });   // unvalidated
}
```

ALWAYS server-side validate.

### Magic strings
```typescript
z.string().refine(s => Object.values(Role).includes(s as Role));
```

```typescript
// ✓ Native enum
z.nativeEnum(Role);
```

## Aksiyon

1. zod schema her DTO için
2. `satisfies z.ZodType<Prisma.XCreateInput>` compile-time check
3. ZodValidationPipe NestJS'te
4. zod-prisma-types ile auto-generate (optional)
5. Hybrid: auto base + manual extend
6. Async refinement (DB check) sadece gerçek unique'lerde
7. Response schema strip sensitive fields
