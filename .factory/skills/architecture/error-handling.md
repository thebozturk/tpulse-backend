---
name: backend-error-handling
keywords: "error, exception, custom, BaseError, async wrapper, global handler"
description: "Backend error handling — BaseError + tip sınıfları, async wrapper, global handler"
---

# Error Handling Disiplini

> shared/.factory/skills/patterns/error-handling.md genel yaklaşımı anlatır. Bu skill backend için **somut implementasyon**.

## Standart response formatı

Tüm response'lar (başarılı veya hatalı) **aynı yapıyı** paylaşır:

```typescript
type ApiSuccess<T> = {
  success: true;
  data: T;
  meta?: { timestamp: string; requestId?: string };
};

type ApiError = {
  success: false;
  error: {
    code: string;       // "VALIDATION_ERROR", "NOT_FOUND", ...
    message: string;    // human-readable
    details?: unknown;  // structured details (zod fieldErrors, vs.)
  };
};
```

Frontend `success` alanına bakarak akışı yönlendirir, `error.code` üzerinden i18n yapar.

## Custom error sınıfları

```typescript
// errors/base.error.ts
export abstract class BaseError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: string;
  readonly details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.details = details;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

// errors/validation.error.ts
export class ValidationError extends BaseError {
  readonly statusCode = 400;
  readonly code = "VALIDATION_ERROR";
}

export class UnauthorizedError extends BaseError {
  readonly statusCode = 401;
  readonly code = "UNAUTHORIZED";
}

export class ForbiddenError extends BaseError {
  readonly statusCode = 403;
  readonly code = "FORBIDDEN";
}

export class NotFoundError extends BaseError {
  readonly statusCode = 404;
  readonly code = "NOT_FOUND";
}

export class ConflictError extends BaseError {
  readonly statusCode = 409;
  readonly code = "CONFLICT";
}

export class RateLimitError extends BaseError {
  readonly statusCode = 429;
  readonly code = "RATE_LIMIT_EXCEEDED";
}

export class InternalError extends BaseError {
  readonly statusCode = 500;
  readonly code = "INTERNAL_ERROR";
}
```

## Service throw

```typescript
class ChatService {
  async getChat(chatId: string, userId: string) {
    const chat = await this.repo.findByIdAndUserId(chatId, userId);
    if (!chat) {
      throw new NotFoundError("Chat not found");    // sadece message
    }
    return chat;
  }

  async createChat(userId: string, dto: CreateChatDto) {
    const exists = await this.repo.existsByTitle(userId, dto.title);
    if (exists) {
      throw new ConflictError("Chat with this title already exists");
    }
    return this.repo.create({ userId, ...dto });
  }
}
```

Service domain hatalarını **tip-spesifik error** ile fırlatır.

## Global error handler

```typescript
// middleware/error-handler.ts
import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { BaseError } from "../errors/base.error";

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  // 1. Custom BaseError
  if (err instanceof BaseError) {
    logger.warn("Handled error", {
      code: err.code,
      message: err.message,
      path: req.path,
      method: req.method,
      userId: (req as any).user?.id,
    });
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
  }

  // 2. Zod validation (eğer middleware'i bypass ettiyse)
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid input",
        details: err.flatten().fieldErrors,
      },
    });
  }

  // 3. Prisma known errors → uygun HTTP
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {  // unique constraint
      return res.status(409).json({
        success: false,
        error: { code: "CONFLICT", message: "Record already exists" },
      });
    }
    if (err.code === "P2025") {  // not found
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Record not found" },
      });
    }
  }

  // 4. Unknown error — generic 500
  logger.error("Unhandled error", {
    err: err instanceof Error ? { message: err.message, stack: err.stack } : err,
    path: req.path,
    method: req.method,
  });

  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: process.env.NODE_ENV === "production"
        ? "An unexpected error occurred"
        : (err instanceof Error ? err.message : String(err)),
      ...(process.env.NODE_ENV !== "production" && err instanceof Error && {
        details: { stack: err.stack },
      }),
    },
  });
}
```

## Async error tuzağı + wrapper

Express **async controller'lardaki throw'u otomatik yakalamaz**.

```typescript
// ❌ Unhandled rejection
router.get("/api/chats", async (req, res) => {
  throw new NotFoundError("Test");
});
```

```typescript
// ✓ asyncHandler wrapper
export function asyncHandler<T extends Request = Request>(
  handler: (req: T, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: T, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

router.get("/api/chats", asyncHandler(controller.listChats));
```

Her async controller `asyncHandler` ile sarılı.

NestJS'de exception filter native — `app.useGlobalFilters(new HttpExceptionFilter())`.

## NestJS exception filter

```typescript
// filters/all-exceptions.filter.ts
import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from "@nestjs/common";
import { BaseError } from "../errors/base.error";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(err: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    if (err instanceof BaseError) {
      logger.warn("Handled", { code: err.code, path: req.url });
      return res.status(err.statusCode).json({
        success: false,
        error: { code: err.code, message: err.message, details: err.details },
      });
    }

    if (err instanceof HttpException) {
      const status = err.getStatus();
      const body = err.getResponse();
      return res.status(status).json({
        success: false,
        error: typeof body === "string" ? { code: "ERROR", message: body } : body,
      });
    }

    logger.error("Unhandled", { err });
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
    });
  }
}

// main.ts
app.useGlobalFilters(new AllExceptionsFilter());
```

## Production'da hata maskelemeli

```typescript
const isProduction = process.env.NODE_ENV === "production";

const errorBody = {
  code: "INTERNAL_ERROR",
  message: isProduction
    ? "An unexpected error occurred"   // generic
    : err.message,                       // detayli
  ...(isProduction ? {} : { details: { stack: err.stack } }),
};
```

Production'da stack trace **client'a dönmemeli** — security risk (path leak, library version leak).

## Hata loglaması — log seviyesi

| HTTP status | Log seviye | Neden |
|-------------|-----------|-------|
| 4xx (client error) | `warn` | Kullanıcı kaynaklı, alarm gerekmez |
| 5xx (server error) | `error` | Sistem sorunu, alarm tetikleyebilir |
| Stack trace | sadece server-side log | Client'a sızdırma |

```typescript
if (err instanceof BaseError) {
  if (err.statusCode >= 500) {
    logger.error("Server error", { code: err.code, err });
  } else {
    logger.warn("Client error", { code: err.code });
  }
}
```

## Sentry / error reporting

```typescript
import * as Sentry from "@sentry/node";

if (err.statusCode >= 500 || !(err instanceof BaseError)) {
  Sentry.captureException(err, {
    user: { id: req.user?.id },
    tags: { path: req.path, method: req.method },
  });
}
```

5xx ve unknown error'lar Sentry'e. 4xx (kullanıcı hatası) Sentry'e **gitmez** — gürültü.

## Test

```typescript
describe("ChatService.getChat", () => {
  it("throws NotFoundError if chat doesn't exist", async () => {
    const repo = { findByIdAndUserId: jest.fn().mockResolvedValue(null) };
    const service = new ChatService(repo as any);

    await expect(service.getChat("c1", "u1")).rejects.toThrow(NotFoundError);
    await expect(service.getChat("c1", "u1")).rejects.toMatchObject({
      code: "NOT_FOUND",
      statusCode: 404,
    });
  });
});
```

## Yapma

- `throw new Error("...")` — generic Error, status code yok, code yok
- `res.status(400).json({error: "..."})` controller'da — handler'a delege et (throw)
- Hata format'ı her endpoint'te farklı — tek format şart
- Production'da stack trace döndürmek
- 4xx'leri Sentry'e göndermek (gürültü)
- `try/catch` her satırda — sadece handle edebileceğin hatayı yakala, kalanı throw
- Error message i18n yapmak (server-side) — `error.code` üzerinden frontend i18n

## Aksiyon

1. `BaseError` abstract class
2. Tip-spesifik sınıflar (Validation, Unauthorized, Forbidden, NotFound, Conflict, RateLimit, Internal)
3. Service'lerde `throw new XError("message")` — generic Error YOK
4. Express'te `asyncHandler` wrapper, NestJS'te exception filter
5. Global error handler / filter — tek format
6. 5xx → Sentry, 4xx → log only
7. Production'da stack mask
8. Test'lerde `expect.rejects.toThrow(SpecificError)`
