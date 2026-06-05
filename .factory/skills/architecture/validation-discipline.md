---
name: validation-discipline
keywords: "validation, zod, schema, body, query, params, middleware"
description: "Validation disiplini — middleware seviyesinde, zod, kaynak ayrımı"
---

# Validation Disiplini

## Hangi katmanda?

**Middleware seviyesinde.** Controller'a kadar gelen veri = **valid varsayımı**.

```
request → ... → validateBody/Query/Params → controller (clean data)
                       ↓ throw
                error handler → 400
```

## Neden zod?

- **Tip-güvenli**: schema'dan TypeScript tipi otomatik türetilir
- **Composable**: küçük schema'lar birleştirilir
- **Error mesajları yapılandırılmış** (`flatten()` ile field-level)
- **Runtime + compile-time tutarlılık**

## Üç farklı kaynak

```typescript
// schemas/chat.schema.ts
import { z } from "zod";

// Body
export const createChatSchema = z.object({
  title: z.string().min(1).max(200),
  initialMessage: z.string().min(1).max(2000).optional(),
});
export type CreateChatDto = z.infer<typeof createChatSchema>;

// Query
export const listChatsSchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
export type ListChatsQuery = z.infer<typeof listChatsSchema>;

// Params
export const chatIdParamSchema = z.object({
  chatId: z.string().uuid(),
});
export type ChatIdParam = z.infer<typeof chatIdParamSchema>;
```

## Validation middleware

```typescript
// middleware/validate.ts
import { ZodSchema } from "zod";
import { Request, Response, NextFunction } from "express";
import { ValidationError } from "../errors/validation.error";

type Source = "body" | "query" | "params";

export function validate(source: Source, schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(
        new ValidationError(`Invalid ${source}`, result.error.flatten().fieldErrors),
      );
    }
    // Replace with parsed (coerced) data
    (req as any)[source] = result.data;
    next();
  };
}

export const validateBody = (schema: ZodSchema) => validate("body", schema);
export const validateQuery = (schema: ZodSchema) => validate("query", schema);
export const validateParams = (schema: ZodSchema) => validate("params", schema);
```

## Route assembly

```typescript
router.post(
  "/api/chats",
  authMiddleware,
  validateBody(createChatSchema),
  asyncHandler(controller.createChat),
);

router.get(
  "/api/chats",
  authMiddleware,
  validateQuery(listChatsSchema),
  asyncHandler(controller.listChats),
);

router.get(
  "/api/chats/:chatId",
  authMiddleware,
  validateParams(chatIdParamSchema),
  asyncHandler(controller.getChat),
);
```

## Controller — clean

```typescript
class ChatController {
  async createChat(req: Request, res: Response) {
    const userId = req.user.id;
    const dto = req.body as CreateChatDto;       // ← validated, type-safe
    const chat = await this.service.createChat(userId, dto);
    res.json({ success: true, data: chat });
  }
}
```

Controller'da `if (!body.title)` YOK — middleware halletti.

## Schema design tips

### UUID
```typescript
chatId: z.string().uuid()
```

### Coercion (string → number)
```typescript
limit: z.coerce.number().int().min(1).max(100)
// "20" → 20
// "abc" → ValidationError
```

Query string'lerde her zaman `coerce` (her şey string gelir).

### Optional vs nullable
```typescript
title: z.string().optional()         // undefined OK
title: z.string().nullable()         // null OK
title: z.string().nullish()          // null veya undefined OK
title: z.string().min(1)             // boş string YASAK
```

### Default value
```typescript
limit: z.coerce.number().int().default(20)
```

### Enum
```typescript
role: z.enum(["user", "assistant", "system"])
```

### Discriminated union
```typescript
export const messageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), content: z.string() }),
  z.object({ type: z.literal("image"), url: z.string().url() }),
  z.object({ type: z.literal("tool_call"), name: z.string(), args: z.record(z.unknown()) }),
]);
```

### Refine (cross-field)
```typescript
export const dateRangeSchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
}).refine(
  (data) => new Date(data.start) < new Date(data.end),
  { message: "end must be after start", path: ["end"] },
);
```

### Transform
```typescript
email: z.string().email().toLowerCase().trim()
```

### Composition
```typescript
const baseUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
});

export const createUserSchema = baseUserSchema.extend({
  password: z.string().min(8),
});

export const updateUserSchema = baseUserSchema.partial();   // tüm field optional
```

## Validation hatası formatı

```typescript
// Frontend'e dönen
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid body",
    "details": {
      "title": ["String must contain at least 1 character(s)"],
      "initialMessage": ["String must contain at most 2000 character(s)"]
    }
  }
}
```

Frontend, `details.<field>` üzerinden hangi input'a hata göstereceğini bilir.

## Output validation (response)

API response shape'ini de validate et — accidental data leak önle:

```typescript
const userResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  // password, mfaSecret, internalNotes intentionally omitted
});

class UserController {
  async getUser(req: Request, res: Response) {
    const user = await this.service.findById(req.params.id);
    const responseData = userResponseSchema.parse(user);   // ← strip extra fields
    res.json({ success: true, data: responseData });
  }
}
```

DTO'larda accidentally `password` gelse bile response'a gitmez.

## NestJS özel — ZodValidationPipe

```typescript
// pipes/zod-validation.pipe.ts
import { PipeTransform, BadRequestException } from "@nestjs/common";
import { ZodSchema } from "zod";

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

// Controller
@Post()
async createChat(
  @Body(new ZodValidationPipe(createChatSchema)) dto: CreateChatDto,
) { /* ... */ }
```

## Yapma

- Controller'da `if (!body.title) return 400` (middleware'e taşı)
- `class-validator` + zod karışık (proje boyu birini seç, zod TS-friendly)
- Schema'yı controller içinde tanımlamak (ayrı dosyada)
- Coerce olmadan query parse (`?limit=20` → string olarak gelir)
- Validation hatasını generic `Error` olarak fırlatmak (ValidationError class)
- Schema'yı export etmemek (frontend de aynı schema'yı kullanmalı — monorepo OK)
- Output validation atlamak (sensitive field response'a sızabilir)
- `safeParse` yerine `parse` middleware'de (parse throw eder, safeParse cleaner)

## Aksiyon

1. zod schema dosyaları `schemas/` klasöründe
2. `validateBody / Query / Params` middleware
3. Tüm route'larda validation, controller'da `if` YOK
4. `z.infer<typeof schema>` ile type-safe DTO export
5. Query'de coerce (`z.coerce.number()`)
6. Discriminated union çoklu tip için
7. Output schema sensitive field strip
8. Hata formatı `details.<field>: string[]`
