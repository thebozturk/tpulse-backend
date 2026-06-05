---
name: middleware-chain
keywords: "middleware, chain, sıra, sequence, pipeline, request processing"
description: "Middleware sıralama mantığı ve route-specific middleware"
---

# Middleware Chain

Middleware = request'i controller'a ulaşmadan **filtreleyen, doğrulayan, zenginleştiren** katman.

## Doğru sıralama

```
1. Request Logger
2. Firebase App Check (bot/spam filter)
3. Authentication (JWT)
4. Client Type Detection
5. Rate Limiting          ← route-specific
6. Feature Flag Check     ← route-specific
7. Request Validation     ← route-specific (zod)
8. Controller
9. Error Handler          ← 4-arg, sona
```

## Her adımın gerekçesi

### 1. Request Logger
**En başta.** Her gelen isteği logla. Hata olsa bile "bu istek geldi" kaydı kalır.

```typescript
export function requestLogger(req, res, next) {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.info("request", {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: duration,
      user_id: req.user?.id,    // auth sonrası dolacak
    });
  });
  next();
}
```

### 2. Firebase App Check (mock veya gerçek)
İsteğin **meşru bir client'tan** geldiğini doğrular. Bot'lar engellenir.

```typescript
export function appCheck(req, res, next) {
  const token = req.headers["x-firebase-appcheck"];
  if (!token) {
    throw new UnauthorizedError("Missing app check token");
  }
  // Gerçekte Firebase Admin SDK ile verify
  // Mock'ta: token mevcut olması yeter
  next();
}
```

**Neden 2. sırada?** Geçemezse JWT decode etmeye gerek yok = CPU israfı önlenir.

### 3. Authentication (JWT)
Kimliği doğrula. `req.user`'ı doldur.

```typescript
export function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing token");
  }
  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    req.user = { id: payload.sub as string };
    next();
  } catch {
    throw new UnauthorizedError("Invalid token");
  }
}
```

### 4. Client Type Detection
Header'dan `x-client-type` oku.

```typescript
export function clientType(req, res, next) {
  const type = req.headers["x-client-type"] as string;
  req.clientType = ["web", "mobile", "desktop"].includes(type)
    ? type as "web" | "mobile" | "desktop"
    : "web";  // default
  next();
}
```

İleride client'a özel davranış için (mobile için daha az veri).

### 5. Rate Limiting (route-specific)

```typescript
export function rateLimit(routeName: string) {
  return (req, res, next) => {
    const userId = req.user?.id ?? req.ip;
    const key = `${routeName}:${userId}`;
    const allowed = rateLimitService.tryConsume(key);
    if (!allowed) {
      throw new RateLimitError("Too many requests");
    }
    next();
  };
}
```

**Neden auth'tan SONRA?** "Gerçek kullanıcı bazlı" rate limit yapılır. Aksi halde geçersiz isteklerin de bucket'ı dolardı (attacker faydası).

### 6. Feature Flag Check (route-specific)

```typescript
export function requireFlag(flagKey: keyof FeatureFlags) {
  return (req, res, next) => {
    if (!flags.isEnabled(flagKey)) {
      throw new ForbiddenError(`Feature ${flagKey} is disabled`);
    }
    next();
  };
}
```

Belirli feature kapatıldığında o endpoint'e erişimi 403 ile engeller.

### 7. Request Validation (route-specific)

```typescript
export function validateBody(schema: ZodSchema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      throw new ValidationError("Invalid body", result.error.flatten());
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema: ZodSchema) { /* same for query */ }
export function validateParams(schema: ZodSchema) { /* same for params */ }
```

Controller'a kadar gelen veri = **valid varsayımı**.

### 8. Controller
Sıranın sonunda gerçek iş.

### 9. Error Handler (4-arg)
Express'in özel davranışı: 4 parametreli middleware error handler'dır. Tüm zincir boyunca fırlatılan hatalar buraya düşer.

```typescript
export function errorHandler(err, req, res, next) {
  if (err instanceof BaseError) {
    logger.warn("Handled error", { code: err.code, path: req.path });
    return res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message, details: err.details },
    });
  }
  // unknown error
  logger.error("Unhandled error", { err: err.stack, path: req.path });
  res.status(500).json({
    success: false,
    error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
  });
}
```

Bkz. `error-handling.md`.

## Route assembly

```typescript
// routes.ts
import { Router } from "express";

const router = Router();

// Global middleware (sırayla)
router.use(requestLogger);
router.use(appCheck);

// Route-specific
router.get(
  "/api/chats",
  authMiddleware,
  clientType,
  rateLimit("list-chats"),
  validateQuery(listChatsSchema),
  asyncHandler(container.chatController.listChats),
);

router.post(
  "/api/chats/:chatId/complete",
  authMiddleware,
  clientType,
  rateLimit("completion"),                   // farklı bucket
  requireFlag("STREAMING_ENABLED"),           // FF check
  validateParams(chatIdParamSchema),
  validateBody(completionBodySchema),
  asyncHandler(container.chatController.complete),
);

// Error handler EN SONA
router.use(errorHandler);

export { router };
```

## Route-specific middleware'in özelliği

**Kötü** (global rate limit):
```typescript
router.use(rateLimit({ max: 60, windowMs: 60_000 }));   // tüm route'lar aynı bucket
```

`/chats` ucuz, `/completion` pahalı. Aynı limit ikisine uygulanırsa: ya liste fazla kısıtlanır ya completion az kısıtlanır.

**İyi** (route-specific):
```typescript
router.get("/api/chats", rateLimit("list-chats"), ...);          // 60/dk
router.post("/api/completion", rateLimit("completion"), ...);     // 10/dk
```

Her route kendi bucket. Granularity korunur.

## Middleware vs Strategy karşılaştırması

| | Middleware | Strategy |
|--|-----------|----------|
| Ne karar verir? | Bu istek **geçer mi geçmez mi?** | Bu istek **nasıl cevaplanır?** |
| Seviye | Request seviyesi | Response seviyesi |
| Sonuç | next() veya throw | execute() ile davranış |
| FF kapalıyken | 403 dön | Karar Factory'den, alternatif strategy |
| Yer | Route assembly | Service içinde |

## Async error tuzağı

Express **async fonksiyonlardaki throw'u otomatik yakalamaz**.

```typescript
// ❌ Express, async throw'u handler'a iletmez → unhandled rejection
router.get("/api/chats", async (req, res) => {
  throw new Error("oops");   // crash veya silent fail
});
```

```typescript
// ✓ asyncHandler wrapper
export function asyncHandler<T extends Request>(
  handler: (req: T, res: Response) => Promise<unknown>,
) {
  return (req: T, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res)).catch(next);
  };
}

router.get("/api/chats", asyncHandler(controller.listChats));
```

Her async controller bu wrapper ile sarılı. NestJS'te bu zaten otomatik (interceptor).

## Yapma

- Middleware sırasını rastgele dizmek
- Validation'ı controller içinde tekrar yapmak
- Auth'tan **önce** rate limit
- App-check'ten **önce** JWT decode
- Global rate limit (tek bucket tüm route'lar)
- Async controller'ı `asyncHandler` olmadan kullanmak
- Error handler'ı middleware listesi ortasında bırakmak (sona koy)
- Middleware içinde DB sorgusu (gerçek "fast" bir filtre olmalı, slow op = bottleneck)
- Sentry/error reporting middleware sona koymak (önce hatayı yakalar, sonra rapor)

## Aksiyon

1. requestLogger her zaman 1. sırada
2. appCheck → auth sırası — bot filter önce
3. Rate limit + FF check route-specific
4. Validation middleware ile, controller temiz
5. asyncHandler tüm async route'larda
6. errorHandler en sonda, 4-arg signature
7. Custom middleware'ı `architecture/error-handling.md` BaseError ile uyumlu fırlatsın
