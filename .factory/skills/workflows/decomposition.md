---
name: decomposition
keywords: "decompose, parçala, böl, break down, subtask, alt görev, atomik"
description: "Büyük iş nasıl küçük, test edilebilir parçalara bölünür"
---

# Decomposition

## Ne zaman kullan

"Yeni bir sistem kur", "modül yaz", "feature ekle" gibi 10+ saat sürecek işler için. Tek oturumda yapılamayacak her iş.

## Atomik birim: 1-2 saatlik build

Her "atomic task":
- Tek bir değişikliği tamamlar (test, doküman dahil)
- Bağımsız commit edilir
- Deploy edilebilir durumda bırakır (WIP kalmaz)
- 1-2 saatte biter

## Decomposition stratejileri

### Strateji 1: Vertical slice (tercih)

Uçtan uca ince bir dilim. Örn. "kullanıcı profil sayfası":

- Slice 1: GET /profile (basit, sadece isim) — bu tek başına çalışır
- Slice 2: avatar alanı ekle
- Slice 3: bio alanı ekle
- Slice 4: edit form

Her slice: backend + contract + frontend. Demo edilebilir.

### Strateji 2: Layer-by-layer (daha nadir)

- Layer 1: DB schema + migration
- Layer 2: service (logic)
- Layer 3: controller + API
- Layer 4: frontend

**Dezavantaj:** Ara layer'lar yalnız başına deploy edilemez. Sadece büyük refactor'larda.

### Strateji 3: Foundation + extension

- Foundation: en basit çalışan hali (happy path)
- Extension 1: error handling
- Extension 2: edge case (empty, too large, etc.)
- Extension 3: performance (caching, batching)

İlk foundation her zaman çalışır. Extension'lar iteratif gelir.

## Karar ağacı

```
Yeni iş istendi
  ├── <1 saat? → decompose etme, direkt build
  ├── 1-4 saat? → 1 slice, tek build
  ├── 4-10 saat? → 2-4 slice
  └── 10+ saat? → epic, /design ile spec çıkar, slice'lara böl
```

## İyi decompose örnek

**Orijinal iş:** "E-commerce için sepet sistemi"

Kötü bölme (layer):
1. DB schema
2. Service
3. Controller
4. Frontend component
5. Tests

Sorun: 1-2-3 tamamlanınca hiçbir şey görünmez. 4 bitince gerçek UX test edilebilir.

İyi bölme (vertical slice):
1. **Slice 1 — Add to cart (only):** DB + POST /cart/add + Frontend "Add" butonu + smoke test. Deploy edilebilir, cart sayısı görünür.
2. **Slice 2 — View cart:** GET /cart + /cart sayfası + test. Sepet içeriği listelenir.
3. **Slice 3 — Update quantity / remove:** PATCH, DELETE /cart/:id + UI butonları.
4. **Slice 4 — Checkout flow:** POST /cart/checkout + checkout sayfası.

Her slice → kullanıcı sipariş verebilir (kısmi). İleride iteratif gelişir.

## Anti-pattern'ler

**"Önce tüm schema'yı tamamlayalım"**
Kaç field gerekli belirsiz. Slice 1'de minimum field'larla başla, Slice 3'te ekle.

**"Test'leri en sona bırakalım"**
Asla. Her slice kendi test'ini taşır. Test olmadan commit → tech debt.

**"Refactor slice olmaz"**
Olur ama nadiren. Refactor genelde yanında bir feature slice'a yapışır (boy scout rule: bıraktığın yerden temiz bırak).

## Aksiyon

Büyük iş geldiğinde:
1. `/design` ile spec çıkar
2. Vertical slice'lara böl (3-6 slice ideal)
3. Her slice için ayrı `active-task` girişi
4. İlk slice'ın /build'i önce (foundation)
5. Her slice commit'le
6. Slice aralarında kullanıcıyla teyit (tempo ayarı)
