---
severity: should
---

# Coding Standards

Generic kural — profil bağımsız. Dile özgü kurallar profile'ların `rules/` altına konur.

## Dosya organizasyonu

**MUST**
- Her dosya tek bir temel sorumluluğa sahip
- Dosya adı içeriği yansıtır (`user-service.ts` → UserService sınıfı)

**SHOULD**
- Dosya <300 satır (daha uzunsa split)
- Sınıf <200 satır
- Fonksiyon <50 satır

## Fonksiyon

**MUST**
- Side effect'siz pure function'lar side effect'lilerden ayrık
- Side effect olan fonksiyon adı fiil başlar (`save`, `send`, `delete`)
- Çok parametreli (>3) → options object kullan

**SHOULD**
- Erken return (nested if yerine)
- Single responsibility — bir fonksiyon bir şey yapar

Kötü:
```typescript
function process(user) {
  if (user) {
    if (user.isActive) {
      if (user.role === 'admin') {
        // gerçek iş buralarda
      }
    }
  }
}
```

İyi:
```typescript
function process(user) {
  if (!user) return;
  if (!user.isActive) return;
  if (user.role !== 'admin') return;

  // gerçek iş
}
```

## Değişken

**MUST**
- `const` default, mutasyon gerekiyorsa `let`
- `var` asla kullanma (ES5 artık ölü)
- Global mutable state → kaçın

**SHOULD**
- Declaration kullanım yerine yakın
- Deeply scoped değişken dış scope'a leak etmesin

## Tip sistemi (TypeScript)

**MUST**
- `any` kullanma (bilinmeyense `unknown`, sonra type guard)
- `as` type assertion'ı son çare — mümkünse type guard
- `@ts-ignore` → `@ts-expect-error` (expect var, ignore gizler)

**SHOULD**
- Public API'de explicit return type
- Strict mode aktif (`strict: true`)
- Generic kullan (any yerine `<T>`)

## Async

**MUST**
- Her `await` try/catch içinde veya caller yakalasın
- Top-level promise'i asla unhandled bırakma
- `async` fonksiyon her zaman Promise dönmeli (imza ile uyumlu)

**SHOULD**
- Paralel işler `Promise.all` (sıralı await zinciri değil)
- Timeout her async external call'da

Kötü:
```typescript
const user = await fetchUser();
const orders = await fetchOrders();
const payments = await fetchPayments();
// 3x ardışık, yavaş
```

İyi:
```typescript
const [user, orders, payments] = await Promise.all([
  fetchUser(),
  fetchOrders(),
  fetchPayments(),
]);
```

## Immutability

**SHOULD**
- Obje/array mutasyon yerine yeni obje döndür (spread)
- `readonly` field'lar tercih
- Deep mutation kaçın (lodash.set değil, immer kullan veya pure spread)

## Error

**MUST**
- Typed exception (generic `Error` değil)
- Error'ı yutma (boş catch yok)
- Error mesajı anlamlı — `throw new Error('')` yasak

Ayrıntı: `skills/patterns/error-handling.md`

## Import

**SHOULD**
- External import önce, sonra internal
- Relative path 2 seviyeyi geçmesin (`../../../` kötü işaret)
- Barrel export'lar (`index.ts`) kullan ama circular dependency yaratma

## Yorum (comment)

**SHOULD**
- Kod "ne yapıyor" yerine "neden yapıyor" yorumla
- TODO/FIXME: isim + tarih + ticket ref
  - `// TODO(@alice 2025-04): refactor when auth-v2 lands (AUTH-42)`
- Commented-out kod → sil (git history'de bulunur)

## Test

**MUST**
- Production kod için test var
- Test adı: `describe_condition_expected`
- AAA pattern: Arrange → Act → Assert
- Test bağımsız (order bağımsız)

**SHOULD**
- Mock dış bağımlılıklar
- Real IO yok (DB, HTTP — testcontainers veya mock)

## Aksiyon

Yeni kod yazarken:
1. Dosya/sınıf adı içeriği yansıtıyor mu?
2. Fonksiyon <50 satır mı?
3. `any` var mı? Yoksa tipler doğru mu?
4. Error handling var mı?
5. Test yazıldı mı?
