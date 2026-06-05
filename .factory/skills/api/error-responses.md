---
name: api-error-responses
keywords: "error, response, RFC 7807, problem details, status code, message"
description: "Consistent error response format"
---

# Error Responses

## Tutarlı format

Her error aynı shape. Frontend tek bir error handler yazar:

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Email is required",
  "errors": [
    { "field": "email", "constraints": ["isEmail"] }
  ],
  "requestId": "req-abc123",
  "timestamp": "2026-04-21T14:30:00Z",
  "path": "/users"
}
```

### Zorunlu field'lar

- `statusCode` — HTTP status (redundant ama helpful)
- `code` — stable machine-readable code (upper_snake_case)
- `message` — human-readable English (i18n için frontend'e bırak)
- `timestamp` — ISO 8601
- `path` — request URL

### Opsiyonel

- `errors` — validation detail array
- `requestId` — tracing için (interceptor ekler)
- `details` — ek context

## Code katalogu

Stable kod'lar (frontend translate eder):

```typescript
export const ErrorCode = {
  // 400
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',

  // 401
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',

  // 403
  UNAUTHORIZED: 'UNAUTHORIZED',
  INSUFFICIENT_ROLE: 'INSUFFICIENT_ROLE',

  // 404
  NOT_FOUND: 'NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',

  // 409
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',

  // 422
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  BUSINESS_RULE_VIOLATION: 'BUSINESS_RULE_VIOLATION',

  // 429
  RATE_LIMITED: 'RATE_LIMITED',

  // 500
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',

  // 502/503
  UPSTREAM_ERROR: 'UPSTREAM_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;
```

Her code için frontend UI mesajı mapping'i vardır.

## RFC 7807 (Problem Details)

Standartlaşmış format alternatifi:
```json
{
  "type": "https://acme.com/errors/email-already-exists",
  "title": "Email already registered",
  "status": 409,
  "detail": "Another user already has this email",
  "instance": "/users"
}
```

RFC 7807 tercih edilebilir ama Acme custom formatı da OK. Frontend ile anlaş.

## Field-level validation errors

Form UI'ında hangi field'ın hatalı olduğunu göstermek için:

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "code": "INVALID_EMAIL",
      "constraints": ["isEmail"],
      "value": "not-an-email"
    },
    {
      "field": "password",
      "code": "TOO_SHORT",
      "constraints": ["minLength"],
      "requirement": 8,
      "actual": 5
    }
  ]
}
```

Global ValidationPipe'ta custom `exceptionFactory` ile üret (bkz. `nestjs/pipes-validation.md`).

## Stack trace

**ASLA** production response'una.

```typescript
// Development ONLY
{
  ...,
  ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
}
```

Production'da stack → log'a, response'a değil.

## Error enumeration önlemi

```typescript
// ❌ BAD — email enumeration
throw new NotFoundException(`User with email ${email} not found`);

// ✓ GOOD — ambiguous
throw new NotFoundException('User not found');
```

Login için özel:
```typescript
// ❌ "Invalid password" ← email valid deme
// ✓ "Invalid email or password" ← generic
throw new UnauthorizedException({
  code: 'INVALID_CREDENTIALS',
  message: 'Invalid email or password',
});
```

## i18n

Error message İngilizce, UI çevirir:

Backend:
```json
{ "code": "EMAIL_ALREADY_EXISTS", "message": "Email already registered" }
```

Frontend:
```typescript
const messages = {
  tr: { EMAIL_ALREADY_EXISTS: 'Bu e-posta zaten kayıtlı' },
  en: { EMAIL_ALREADY_EXISTS: 'Email already registered' },
};
const msg = messages[locale][error.code] ?? error.message;
```

Backend kod yayınlar, frontend metin.

## Rate limit response

429:
```json
{
  "statusCode": 429,
  "code": "RATE_LIMITED",
  "message": "Too many requests",
  "retryAfter": 30
}
```
Header: `Retry-After: 30` (seconds).

## Anti-pattern'ler

### Tutarsız format
```
GET  /users/:id  → { error: "..." }
POST /users      → { msg: "...", code: 123 }
```

### Generic error
```json
{ "error": "something went wrong" }
```
Frontend bir şey yapamaz.

### Database error expose
```json
{ "message": "E11000 duplicate key error collection: users..." }
```
DB internal bilgi leak.

### HTTP status ≠ response
```typescript
response.status(500).json({ statusCode: 200, ... })
```
Kafa karıştırır.

## Aksiyon

1. Global exception filter oluştur
2. Error code katalogu paylaş
3. Message English, frontend çevirir
4. Stack trace sadece dev
5. PII leak yok (email enumeration)
6. Request ID tracing için
7. Validation → field-level errors
