---
name: api-versioning
keywords: "versioning, v1, v2, deprecation, breaking change, semver"
description: "API versioning strategies"
---

# Versioning

## Strateji seçimi

### URI prefix (tercih)
```
/v1/users
/v2/users
```
**Pro:** Explicit, cache-friendly, dokümanda net.
**Con:** Full URL değişir.

### Header
```
Accept: application/vnd.acme.v2+json
```
**Pro:** URL stabil.
**Con:** Dokümantasyon karmaşık, test zor.

### Query param
```
/users?version=2
```
**Pro:** Kolay test.
**Con:** Caching zor.

**Öneri:** URI prefix default, ihtiyaç olursa header fallback.

## NestJS versioning

```typescript
// main.ts
app.enableVersioning({
  type: VersioningType.URI,
  defaultVersion: '1',
});

// controller
@Controller({ path: 'users', version: '1' })
export class UsersControllerV1 {}

@Controller({ path: 'users', version: '2' })
export class UsersControllerV2 {}
```

## Ne zaman bump

### MAJOR (v1 → v2)
- Endpoint silindi
- Response field tip değişti
- Required field eklendi request'e
- HTTP method değişti

### MINOR (v1.1)
- Yeni endpoint
- Optional field eklendi response'a
- New query parameter

### PATCH (v1.0.1)
- Bug fix (aynı response)
- Performance iyileştirme

MINOR/PATCH için URI değişmez — sadece changelog.

## Deprecation flow

```
v2 yayınlandı → v1 deprecated (ama çalışıyor)
  ↓ 3-6 ay geçti
v1 sunset (kaldırıldı)
```

### Deprecation response header
```
Deprecation: true
Sunset: Wed, 31 Dec 2026 23:59:59 GMT
Link: </v2/users>; rel="successor-version"
```

NestJS'te interceptor ile:
```typescript
@Injectable()
export class DeprecationInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler) {
    const res = ctx.switchToHttp().getResponse();
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', 'Wed, 31 Dec 2026 23:59:59 GMT');
    return next.handle();
  }
}
```

## Migration guide

Her major bump için dokümanda:
```markdown
# v1 → v2 Migration

## Breaking changes
1. GET /users response: `name` field → `fullName`
2. POST /auth/login: `email` field artık case-insensitive

## Automated
Frontend client'ta:
  pnpm api:upgrade v2
```

## Anti-pattern'ler

### Silent breaking change
Major bump yapmadan response değiştirme → frontend kırılır.

### Çok fazla versiyon
v1, v2, v3, v4 aktif → maintenance patlar. Max 2 aktif versiyon tut.

### URI ≠ Content-Type
`/v1/users` döner `v2` response → karmaşa.

## Aksiyon

- Başta URI prefix (opsiyonel) — başlangıçta tek versiyon `/v1/`
- Breaking change gerekiyorsa major bump
- Deprecation header 3-6 ay
- Migration guide her major için
- Max 2 aktif versiyon
