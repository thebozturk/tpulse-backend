---
name: naming
keywords: "naming, isim, variable, function, class, file, adlandırma"
description: "Tutarlı, açıklayıcı isimlendirme"
---

# Naming

## Temel prensip

İsim = "bu şey ne yapar?" sorusuna **tek cümleyle** cevap. İsmi okuyan kod satırını okumadan anlamalı.

Her proje kendi convention'ını taşır — `.factory/memory/conventions.json`'a bak. Kendi tercihini dayatma.

## Tipik kategoriler

### Variables
- `user`, `activeUsers`, `pendingOrders` — ne olduğunu söyler
- `i`, `j`, `k` sadece kısa loop index'i için
- `flag`, `data`, `result` → belirsiz, daha spesifik yap
- `userList` yerine `users` (tip zaten liste)

### Functions
- **Fiil ile başla:** `getUser`, `calculateTax`, `validateEmail`
- Boolean dönen: `is*`, `has*`, `can*`, `should*`
  - `isAdmin`, `hasPermission`, `canEdit`, `shouldRetry`
- Command: `create*`, `update*`, `delete*`, `send*`
- Query: `find*`, `get*`, `load*`, `fetch*`

### Classes / Interfaces
- **İsim (noun) ile:** `User`, `OrderService`, `PaymentGateway`
- Tipte anlatım:
  - `Service` → business logic barındırır (UserService)
  - `Repository` → data access
  - `Controller` → HTTP giriş noktası
  - `Adapter` → harici bir şeye köprü
  - `Factory` → instance üretir
  - `Strategy` → algoritma değiştirilebilir

### Files
- Convention'a göre: `kebab-case.ts`, `camelCase.ts`, `PascalCase.tsx`
- Proje ne kullanıyorsa ona uy

## Boolean isimlendirme

Kötü:
```typescript
const user = true;  // ne boolean user bu?
const active = false; // active olan ne?
```

İyi:
```typescript
const isActive = true;
const hasSubscription = false;
const canAccessAdmin = user.role === 'admin';
```

Negation dikkat:
```typescript
if (!isNotVisible) { ... }  // çift negation — beyin yakar
if (isVisible) { ... }       // iyi
```

## Function isimlendirme

Kötü:
```typescript
function process(data) { ... }   // ne process?
function handle(user) { ... }    // ne handle?
function doIt() { ... }          // ne it?
```

İyi:
```typescript
function calculateShippingCost(order) { ... }
function sendPasswordResetEmail(user) { ... }
function validateCreditCardNumber(num) { ... }
```

**Side effect sinyali:**
- Saf function: `calculate`, `parse`, `format`, `map`
- Side effect: `save`, `send`, `post`, `delete`, `update`

## Magic number / string

```typescript
if (user.age > 18) { ... }                    // 18 ne?
setTimeout(fn, 3600000);                       // 3.6M ms = 1 saat
if (response.status === 'SUCCESS_CODE') { ... } // niye string?
```

Sabit olarak çıkar:
```typescript
const LEGAL_AGE = 18;
const ONE_HOUR_MS = 60 * 60 * 1000;
const ResponseStatus = { Success: 'SUCCESS', Error: 'ERROR' } as const;

if (user.age > LEGAL_AGE) { ... }
setTimeout(fn, ONE_HOUR_MS);
if (response.status === ResponseStatus.Success) { ... }
```

## Abbreviation (kısaltma)

Genel olarak kısaltma → kafa karıştırır. Uzun yaz:
- `usr` → `user`
- `cfg` → `config`
- `btn` → `button`

İstisnalar (herkesin bildiği):
- `id`, `url`, `http`, `api`, `db`, `max`, `min`

## Context ile isim

Aynı concept'e iki yerde iki isim → karmaşa. Örn:
- `customer`, `client`, `user` üçü aynı şey için? Seç birini, kod tabanında tutarlı.

Class içinde class adını tekrar etme:
```typescript
// kötü
class User {
  userId: string;
  userName: string;
  userEmail: string;
}

// iyi
class User {
  id: string;
  name: string;
  email: string;
}
```

## Anti-pattern'ler

**Hungarian notation** (`strName`, `intAge`, `bIsActive`)
TypeScript'te tip zaten var. Bırak.

**Tek harf variable (loop dışında)**
`const u = users[0]` — u ne? `user` yaz.

**`_` ile başlayan public**
`_private` genellikle private işareti. Public ise başında `_` olmaz.

**Reserved word ile çakışma**
`class`, `type`, `default` → `class` ve `type` yasaklı (parse hatası). `default` dikkat.

**Generic isim + context'i farklı**
`data` her yerde var → hangisinin ne olduğunu anlamak zor. `userData`, `orderData` gibi spesifik yap.

## Aksiyon

Her yeni isim koyarken:
1. Conventions'a bak — proje ne kullanıyor
2. Ne yaptığı/olduğu tek cümleyle söylenebilir mi
3. Kısaltma varsa herkes bilir mi
4. Boolean ise `is/has/can/should` ile mi başlıyor
5. Context'e uygun mu (aynı concept → aynı isim)
