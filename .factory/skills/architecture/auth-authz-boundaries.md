---
name: auth-authz-boundaries
keywords: "authentication, authorization, JWT, ownership, RBAC, broken access control"
description: "Authentication vs Authorization sınırı, ownership check, OWASP Broken Access Control"
---

# Authentication ve Authorization Sınırları

## İki kavram, iki katman

**Authentication** ("kimsin?"): Kullanıcının kimliğini doğrula → `req.user`'ı doldur. **Middleware seviyesi.**

**Authorization** ("yapma hakkın var mı?"): Belirli aksiyonu yapma yetkisi → kararı service/repo verir. **Business kuralı.**

İkisini karıştırmak çoğu güvenlik açığının kaynağı.

## JWT — basit kullanım

```typescript
// middleware/auth.middleware.ts
import jwt from "jsonwebtoken";
import { UnauthorizedError } from "../errors/unauthorized.error";

export function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing or malformed token");
  }
  const token = auth.slice(7);

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { sub: string; role?: string };
    req.user = {
      id: payload.sub,
      role: payload.role ?? "user",
    };
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      throw new UnauthorizedError("Token expired");
    }
    throw new UnauthorizedError("Invalid token");
  }
}
```

Sonraki tüm middleware ve controller `req.user.id`'ye **güvenir**.

## Token üretimi (test için)

```typescript
// scripts/gen-token.ts
import jwt from "jsonwebtoken";
import { env } from "../src/config/env";

const userId = process.argv[2] ?? "test-user-1";
const role = process.argv[3] ?? "user";

const token = jwt.sign(
  { sub: userId, role },
  env.JWT_SECRET,
  { expiresIn: "7d" },
);

console.log(token);
```

```bash
$ pnpm gen-token user-123 admin
eyJhbGciOiJIUzI1NiIs...

$ curl -H "Authorization: Bearer eyJhbGc..." http://localhost:3000/api/chats
```

## Firebase App Check (mock)

```typescript
// middleware/app-check.middleware.ts
export function appCheck(req, res, next) {
  const token = req.headers["x-firebase-appcheck"];
  if (!token) {
    throw new UnauthorizedError("Missing app check token");
  }
  // Production'da Firebase Admin SDK ile verify
  // Mock'ta: token mevcut olması yeter
  next();
}
```

Production'da: `admin.appCheck().verifyToken(token)`.

## Ownership check disiplini

**En kritik kural: Her DB sorgusunda userId filtresi olmalı.**

### Yanlış (Broken Access Control — OWASP Top 10)

```typescript
// repository
async findById(chatId: string) {                      // ← user filter YOK
  return this.prisma.chat.findUnique({ where: { id: chatId } });
}

// service
async getChat(chatId: string, userId: string) {
  const chat = await this.repo.findById(chatId);
  if (chat?.userId !== userId) {                       // ← service unutursa?
    throw new ForbiddenError();
  }
  return chat;
}

// controller
async getChat(req, res) {
  const chat = await this.service.getChat(req.params.id, req.user.id);
  res.json(chat);
}
```

Service unutsa? Her başkasının chat'i erişilebilir olur. **Single point of failure.**

### Doğru — Repository imzasında zorla

```typescript
// repository — userId ZORUNLU
async findByIdAndUserId(chatId: string, userId: string): Promise<Chat | null> {
  return this.prisma.chat.findFirst({
    where: { id: chatId, userId },                      // ← scoped query
  });
}

// service
async getChat(chatId: string, userId: string) {
  const chat = await this.repo.findByIdAndUserId(chatId, userId);   // ← compile-time zorlama
  if (!chat) throw new NotFoundError("Chat not found");
  return chat;
}

// controller
async getChat(req, res) {
  const chat = await this.service.getChat(req.params.id, req.user.id);
  res.json({ success: true, data: chat });
}
```

**Fail-safe**: Repository imzası `userId` olmadan derlenmez. Service unutamaz.

## "Yok" ile "yetki yok" aynı cevabı verir

```typescript
async getChat(chatId: string, userId: string) {
  const chat = await this.repo.findByIdAndUserId(chatId, userId);
  if (!chat) throw new NotFoundError("Chat not found");   // ← her iki case'te aynı
  return chat;
}
```

Frontend hem "var ama senin değil" hem "hiç yok" durumunu **aynı 404** olarak görür.

**Neden?** Bilgi sızdırmaz. Eğer "ForbiddenError" döndürseydin attacker "bu ID var ama benim değil" bilgisini öğrenirdi (ID enumeration).

## RBAC (Role-Based Access Control)

```typescript
// guards/roles.guard.ts
export function requireRole(...roles: string[]) {
  return (req, _res, next) => {
    if (!req.user) {
      throw new UnauthorizedError("Authentication required");
    }
    if (!roles.includes(req.user.role)) {
      throw new ForbiddenError(`Requires one of: ${roles.join(", ")}`);
    }
    next();
  };
}

// route
router.delete(
  "/api/users/:userId",
  authMiddleware,
  requireRole("admin"),               // ← sadece admin
  validateParams(userIdParamSchema),
  asyncHandler(controller.deleteUser),
);
```

NestJS:
```typescript
@Roles("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Delete(":id")
async deleteUser(@Param("id") id: string) { /* ... */ }
```

## Per-resource authorization

Sadece role değil, kaynak bazlı yetki:

```typescript
class ChatService {
  async deleteChat(chatId: string, currentUser: { id: string; role: string }) {
    const chat = await this.repo.findById(chatId);   // ← admin scoped query'siz okuyabilir
    if (!chat) throw new NotFoundError();

    const isOwner = chat.userId === currentUser.id;
    const isAdmin = currentUser.role === "admin";

    if (!isOwner && !isAdmin) {
      throw new ForbiddenError("Not allowed to delete this chat");
    }

    await this.repo.delete(chatId);
  }
}
```

**Owner OR admin** pattern. Ama **default**: scoped query (yukarıdaki ownership check) — sadece istisnalarda role-bazlı yetki ekle.

## Rate limit + auth sırası

```
1. App check
2. Auth (req.user dolu)              ← burada
3. Rate limit (per-user bucket)
4. Route handler
```

Auth ÖNCE → rate limit gerçek user bazlı çalışır. Aksi halde anonymous istekler de bucket tüketir.

## Refresh token (kısa TTL access + long-lived refresh)

```typescript
// auth.service.ts
async login(email: string, password: string) {
  const user = await this.userRepo.findByEmail(email);
  if (!user) throw new UnauthorizedError("Invalid credentials");

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new UnauthorizedError("Invalid credentials");

  const accessToken = jwt.sign(
    { sub: user.id, role: user.role },
    env.JWT_SECRET,
    { expiresIn: "15m" },
  );

  const refreshToken = jwt.sign(
    { sub: user.id, type: "refresh" },
    env.JWT_REFRESH_SECRET,
    { expiresIn: "7d" },
  );

  // Refresh token hash'ini DB'ye sakla (revoke için)
  await this.userRepo.update(user.id, {
    refreshTokenHash: await bcrypt.hash(refreshToken, 10),
  });

  return { accessToken, refreshToken };
}
```

Access 15dk = compromise window kısa. Refresh 7 gün = UX iyi. Refresh DB'de hash'lenmiş = revoke edilebilir.

## Sensitive field güvenliği

```prisma
model User {
  id               String   @id
  email            String   @unique
  passwordHash     String
  refreshTokenHash String?
  mfaSecret        String?
}
```

Response'a `passwordHash`, `refreshTokenHash`, `mfaSecret` **asla** gitmemeli. Output schema ile strip et:

```typescript
const userResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  // password, refreshTokenHash, mfaSecret intentionally omitted
});

class UserController {
  async getProfile(req, res) {
    const user = await this.service.findById(req.user.id);
    const safe = userResponseSchema.parse(user);
    res.json({ success: true, data: safe });
  }
}
```

## Yapma

- `if (chat.userId !== currentUserId) throw Forbidden` — service'te manual check (repo imzası ile zorla)
- `findById` repository'de userId-less — scoped query default
- Authorization'ı middleware'de yapmak (resource-level değildir, service'in işi)
- Authentication'ı service'te yapmak (middleware'in işi)
- "Yetkin yok" mesajı bilgi sızdıracak şekilde (404 ile maskele)
- JWT secret'ı kısa (`min 16 char` zorla, ideal 32+)
- Refresh token'ı DB'de plain text saklamak (hash et)
- Token expiry yok — geçerlilik süresiz
- Sensitive field response'a sızdırmak (output schema strip)

## Aksiyon

1. `authMiddleware` JWT verify, `req.user` dolu
2. App check middleware (mock veya gerçek)
3. Repository imzasında `userId` ZORUNLU (`findByIdAndUserId`)
4. Service "yok" ile "yetki yok"u aynı 404 ile döndür
5. Role-based için `requireRole` guard middleware
6. Resource-level yetki service'te (owner OR admin pattern)
7. Sensitive field output schema ile strip
8. JWT secret min 16 char (zod validate)
9. Refresh token DB'de hash'li
