# TransferPulse — Mobil Liste / Filtre / Pagination Refactor Entegrasyonu

Bu belge, **listeleme uçlarındaki** filtreleme + sayfalama refactor'ının mobil app
entegrasyonunu anlatır. Amaç: mobil **hiçbir zaman "hepsini" çekmesin** — her liste
sayfalı gelir, lig/takım bazında sunucu tarafında filtrelenir.

> **TL;DR:**
> 1. Tüm liste uçları artık `{ items, page, pageSize, totalCount, totalPages }`
>    (PagedResult) döner. `page` (default 1) + `pageSize` (default 20, max 100) gönder.
> 2. Transferler default'ta **en güncel 20**; en pahalıyı istersen `sort=-feeAmount`.
> 3. Lig/takım filtresi sunucu tarafında: `?leagueId=…`, `?teamId=…`.
> 4. **Takım ve oyuncu listeleri filtresiz boş döner** — önce lig (veya arama) seç.
> 5. Eskiden "hepsini" dönen bazı uçlar artık sayfalı (aşağıdaki ⚠️ BREAKING tablosu).

---

## 1. Ortak zarf (envelope)

Tüm sayfalı uçlar **birebir** şu yapıyı döner:

```jsonc
{
  "items": [ /* … kayıtlar … */ ],
  "page": 1,
  "pageSize": 20,
  "totalCount": 137,
  "totalPages": 7
}
```

- Sonraki sayfa: `page + 1` (≤ `totalPages` olduğu sürece).
- Infinite scroll: `items` boş gelene kadar veya `page >= totalPages` olana kadar.
- `items` anahtarı korunur — eski kod `.items` okumaya devam edebilir, ama artık
  **tek sayfa** gelir (hepsini değil).

### Ortak query parametreleri

| Param | Default | Sınır | Açıklama |
|-------|---------|-------|----------|
| `page` | `1` | ≥1 | Sayfa numarası (1-tabanlı) |
| `pageSize` | `20` | 1–100 | Sayfa boyutu |
| `sort` | uca göre | — | `alan` (artan) / `-alan` (azalan). Bkz. ilgili uç |

---

## 2. Transferler

### `GET /api/transfers` — ana transfer listesi (filtreli)
Default: **en güncel 20** (`createdAt` azalan). Filtreler birleştirilebilir.

| Param | Tip | Açıklama |
|-------|-----|----------|
| `leagueId` | uuid | **YENİ** — kaynak veya hedef takımın ligi |
| `teamId` | uuid | **YENİ** — gelen veya giden (iki taraftan biri) |
| `fromTeamId` / `toTeamId` | uuid | Belirli yön |
| `playerId` | uuid | Oyuncu |
| `feeMin` / `feeMax` | number | Bedel aralığı |
| `dateFrom` / `dateTo` | ISO date | Tarih aralığı |
| `currency` | string | Para birimi |
| `sort` | string | `createdAt`, `transferDate`, `feeAmount` (`-` ile azalan) |

**En yüksek bedelli ilk 20 (bir liginde):**
```
GET /api/transfers?leagueId=<id>&sort=-feeAmount&page=1&pageSize=20
```

**Bir takımın tüm transferleri (gelen+giden), sayfalı:**
```
GET /api/transfers?teamId=<id>&page=1&pageSize=20
```

### `GET /api/transfers/top-expensive`
En pahalı transferler (zaten `-feeAmount` sıralı). Params: `page`, `pageSize`, `currency?`.

### `GET /api/transfers/latest`
Son transferler. Params: `page`, `pageSize`.

### ⚠️ Sayfalıya dönen uçlar (eskiden hepsini dönüyordu)
| Uç | Yeni paramlar |
|----|---------------|
| `GET /api/transfers/between-teams` | `fromTeamId`, `toTeamId`, `includeReverse?`, **`page`**, **`pageSize`** |
| `GET /api/transfers/by-year/:year` | **`page`**, **`pageSize`**, **`sort?`** |
| `GET /api/transfers/by-month/:year/:month` | **`page`**, **`pageSize`**, **`sort?`** |

---

## 3. Takımlar

### `GET /api/teams` — takım listesi (lig + isim filtreli)
> **Önemli:** `leagueId` **veya** `search`'ten en az biri verilmezse uç **boş sayfa**
> döner (`totalCount: 0`). Yani "tüm takımlar" diye bir varsayılan liste yok —
> kullanıcı önce lig seçer ya da arama yapar.

| Param | Tip | Açıklama |
|-------|-----|----------|
| `leagueId` | uuid | **YENİ** — ligin takımları |
| `search` | string | İsim araması (aksan-duyarsız, tüm DB'de — sayfa içi değil) |
| `page` / `pageSize` | number | Sayfalama |

```
GET /api/teams?leagueId=<id>&page=1&pageSize=20      # ligin takımları
GET /api/teams?search=galata                          # isimle ara (tüm DB)
GET /api/teams?leagueId=<id>&search=bjk               # lig içinde ara
```

### ⚠️ `GET /api/teams/by-league/:leagueId` — artık **sayfalı**
Params: `page`, `pageSize`. (Aramasız; arama için yukarıdaki `?leagueId=&search=` kullan.)

### ⚠️ Takım transfer uçları — artık **sayfalı**
`GET /api/teams/:teamId/incoming-transfers` · `…/outgoing-transfers` · `…/transfers`
→ hepsi `page`, `pageSize`, `sort?` alır.

---

## 4. Oyuncular

### `GET /api/players` — oyuncu listesi (filtreli)
> **Önemli:** En az bir filtre (`leagueId`, `teamId`, `nationality`, `positionId`,
> `isFree` veya `search`) yoksa uç **boş sayfa** döner. Önce lig/takım seç ya da ara.

| Param | Tip | Açıklama |
|-------|-----|----------|
| `leagueId` | uuid | **YENİ** — ligin oyuncuları (takım üzerinden) |
| `teamId` | uuid | Takımın oyuncuları |
| `nationality` | string | Uyruk |
| `positionId` | uuid | Pozisyon |
| `isFree` | boolean | Serbest oyuncular |
| `search` | string | İsim araması (aksan-duyarsız, tüm DB'de) |
| `page` / `pageSize` | number | Sayfalama |

```
GET /api/players?leagueId=<id>&page=1&pageSize=20
GET /api/players?teamId=<id>
GET /api/players?search=osimhen
```

---

## 5. ⚠️ BREAKING — mobilde yapılması gerekenler

| Değişim | Etki | Aksiyon |
|---------|------|---------|
| Liste uçları tek sayfa döner (hepsini değil) | Sonsuz liste ekranları eksik veri gösterebilir | `page`/`pageSize` ile sayfalama/infinite-scroll ekle |
| `teams` & `players` filtresiz **boş** döner | Filtresiz "tüm takımlar/oyuncular" ekranı boş kalır | Önce lig seçtir (veya arama kutusu); seçimden sonra istek at |
| `between-teams`, `by-year`, `by-month`, takım transfer uçları sayfalı | `.items` hâlâ var ama 20 kayıtla sınırlı | Sayfalama ekle |
| Arama artık server-side | Sayfa içi (client) filtrelemeye gerek yok | İsim aramasını `?search=` ile backend'e bırak |

**Önemli ilke:** Arama/filtre **client'ta sayfa içinde değil**, `?search=`/`?leagueId=`
query'siyle backend'de yapılmalı — aksi halde aranan kayıt o sayfada yoksa bulunamaz.

---

## 5.1. Arama & kaynak filtreleri (YENİ)

Önceden backend desteklemediği için kaldırılan **oyuncu/başlık araması** ve
**kaynak çipleri** artık server-side. Hepsi pagination ile uyumlu — arama tüm
veride çalışır, sayfa içinde değil.

### Transferler & söylentiler
`GET /api/transfers` ve `GET /api/rumours` şu paramları kabul eder:

| Param | Açıklama |
|-------|----------|
| `search` | **YENİ** — oyuncu adı (aksan-duyarsız; "kilicsoy" → "Kılıçsoy") |
| `source` | **YENİ** — `Manual` / `ApiSports` / `Bot` (sabit enum; çipler bundan) |
| `leagueId` / `teamId` | Lig / takım (rumours'a da eklendi) |

```
GET /api/transfers?search=osimhen&page=1&pageSize=20
GET /api/transfers?source=ApiSports&leagueId=<id>&sort=-feeAmount
GET /api/rumours?search=icardi&source=Manual
```

### Haberler
`GET /api/news` şu paramları kabul eder:

| Param | Açıklama |
|-------|----------|
| `search` | **YENİ** — başlık araması (aksan-duyarsız) |
| `sourceName` | **YENİ** — kaynak adı tam eşleşme (çip seçimi) |
| `sortBy` / `order` | `publishDate`/`title` + `asc`/`desc` |

**Kaynak çipleri için:** `GET /api/news/sources` → `{ "items": ["Fabrizio Romano", "AMK", …] }`
(kullanılan farklı kaynak adları). Çipleri bundan kur, seçilince `?sourceName=` ile filtrele.

```
GET /api/news?search=transfer&page=1&pageSize=20
GET /api/news?sourceName=Fabrizio%20Romano&sortBy=publishDate&order=desc
GET /api/news/sources
```

> İlke (tekrar): arama/kaynak filtresi **client'ta sayfa içinde değil**, query
> param'la backend'de. Aranan kayıt başka sayfadaysa bile bulunur.

---

## 6. Hızlı referans

```
# Lig panoraması (en pahalı 20)
GET /api/transfers?leagueId=<lig>&sort=-feeAmount&pageSize=20

# Takım profili: son transferler (sayfalı)
GET /api/teams/<takım>/transfers?page=1&pageSize=20

# Takım seçici: lig → takımlar
GET /api/teams?leagueId=<lig>&pageSize=50

# Oyuncu arama (global)
GET /api/players?search=<isim>&pageSize=20
```
