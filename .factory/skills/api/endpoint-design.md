---
name: api-endpoint-design
keywords: "endpoint, REST, route, URL, resource, naming, API design"
description: "REST endpoint naming ve URL structure"
---

# Endpoint Design

## Resource-oriented URL

**Noun, verb değil.**

```
✓ GET    /users            → list
✓ GET    /users/:id        → get one
✓ POST   /users            → create
✓ PATCH  /users/:id        → partial update
✓ PUT    /users/:id        → full replace
✓ DELETE /users/:id        → remove

✗ GET    /getUsers          → verb
✗ POST   /createUser        → verb
✗ GET    /user-list         → farklı naming
```

## Nested resource

İlişkili kaynaklar:
```
GET    /users/:userId/orders       → user'ın siparişleri
GET    /users/:userId/orders/:id   → belirli sipariş
POST   /users/:userId/orders       → sipariş oluştur
```

Max 2 seviye nesting. Daha derin → flat yapın:
```
✗ GET /users/:uid/orders/:oid/items/:iid/details
✓ GET /order-items/:iid (query ile: ?orderId=...)
```

## Collection vs singleton

```
/users           — collection (multiple)
/users/me        — singleton (her user için tek)
/users/:id       — specific item
```

`/me` pattern current user için standart.

## HTTP method semantik

| Method | Idempotent | Body | Use |
|--------|-----------|------|-----|
| GET | ✓ | ✗ | Read |
| HEAD | ✓ | ✗ | Metadata check |
| POST | ✗ | ✓ | Create / action |
| PUT | ✓ | ✓ | Full replace |
| PATCH | ✗ (strict), genelde idempotent | ✓ | Partial update |
| DELETE | ✓ | ✗ (genelde) | Remove |

**PUT vs PATCH:**
- PUT: tüm resource'u değiştir (boşsa null yap)
- PATCH: sadece verilen field'ları güncelle

## Action endpoint (verb gerekli durumlar)

Bazı işlemler REST'e uymaz:
```
POST /orders/:id/cancel      — sipariş iptal
POST /users/:id/send-reset   — reset email
POST /auth/refresh           — token yenile
```

Bu durumlarda POST kullan, verb'i path'e koy. Ama önce "yeni resource" olarak tasarlanabilir mi düşün:
```
# alternatif
POST /orders/:id/cancellations    — cancellation resource'u
POST /password-resets              — reset resource'u
```

## URL convention

- **kebab-case** tercih: `/user-profiles`, `/order-items`
- Alternatif: **camelCase**: `/userProfiles` (tutarlı olsun)
- Snake_case nadir: `/user_profiles`
- Path parameter **ID veya slug**: `/users/:id` veya `/users/:slug`
- Trailing slash **yok**: `/users/` değil `/users`

## Plural collection

```
✓ /users       (plural noun)
✗ /user        (singular, yanlış)
```

İstisna: singleton:
```
/me, /current-order  (singular OK)
```

## Status code kullanımı

| Code | Anlam | Örnek |
|------|-------|-------|
| 200 OK | Success with body | GET, PATCH, DELETE (body var) |
| 201 Created | Created resource | POST |
| 204 No Content | Success, no body | DELETE (body yok), PUT |
| 400 Bad Request | Validation fail | Invalid input |
| 401 Unauthorized | Auth yok/invalid | No token |
| 403 Forbidden | Auth OK, permission yok | Wrong role |
| 404 Not Found | Resource yok | User not exists |
| 409 Conflict | State conflict | Email already used |
| 422 Unprocessable | Validation semantic | Valid JSON but business rule fail |
| 429 Too Many | Rate limit | Throttle hit |
| 500 Internal | Sunucu hatası | Uncaught exception |
| 502 Bad Gateway | Upstream fail | DB down, external API fail |
| 503 Service Unavailable | Maintenance/shutdown | Graceful shutdown |

## Query parameters

Filter, sort, pagination:
```
GET /users?status=active&sort=-createdAt&page=2&pageSize=20
GET /orders?filter[status]=pending&filter[userId]=123
```

Convention'a göre ya flat (`status=active`) ya bracket (`filter[status]=active`).

## Content negotiation

```
Accept: application/json
Content-Type: application/json
```

Alternatif format gerekmiyorsa varsayılan JSON. XML, CSV sadece ihtiyaçta.

## Versioning

Başlangıçta gerek yok. Ekle:
- URI prefix: `/v1/users`, `/v2/users`
- Header: `Accept: application/vnd.acme.v2+json`

Bkz. `versioning.md`.

## Idempotency key

POST'ta (non-idempotent) aynı işlemin tekrarını önlemek:
```
POST /payments
Idempotency-Key: <uuid>
```

Server key'i saklar, aynı key ile aynı request → önceki response'u döner. Retry'ları güvenli yapar.

## Anti-pattern'ler

### Verb path
```
POST /createUser              ❌
GET  /getUsersByStatus/:s     ❌
POST /users/delete/:id        ❌ (DELETE kullan)
```

### Tutarsız plural
```
/user + /orders               ❌ (birbirinden farklı)
/users + /orders              ✓
```

### Deep nesting
```
/users/:u/orgs/:o/teams/:t/members/:m/settings ❌
```

### Inconsistent case
```
/userProfiles + /order-items  ❌
```

### Method misuse
```
GET /users/delete/:id         ❌ (GET idempotent değil)
POST /users/:id (için update) ❌ (PATCH veya PUT)
```

## Aksiyon

1. Resource tanımla — noun, plural
2. Standart CRUD: GET/POST/GET:id/PATCH/DELETE
3. Action için verb path (nadir)
4. URL convention seç (kebab-case tercih)
5. Status code doğru — 201 Created için POST
6. Idempotency key POST'ta (payment vs.)
7. Query filter/sort/pagination
