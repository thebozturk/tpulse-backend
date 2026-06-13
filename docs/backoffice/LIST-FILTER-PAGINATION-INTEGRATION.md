# TransferPulse — Panel (Backoffice) Liste / Filtre / Pagination Refactor

Bu belge, **panelin liste ekranlarındaki** filtreleme + sayfalama refactor'ını ve
çözülen "filtrelediğim kayıt o sayfada yoksa bulunamıyor" bug'ını anlatır.

> **TL;DR:**
> 1. Panel, transfer/takım/lig/oyuncu listelemesi için **public read uçlarını**
>    kullanır (admin controller'ları sadece create/update/delete yapar — liste yok).
> 2. Tüm listeler sayfalı: `{ items, page, pageSize, totalCount, totalPages }`.
> 3. **Arama/filtre artık server-side, tüm veride** — sayfa içinde (client) filtreleme YAPMA.
> 4. Takım & oyuncu listeleri **filtresiz boş döner** → önce lig seç ya da ara.

---

## 1. Çözülen bug — "sayfada yoksa bulamıyor"

**Eski davranış:** Panel lige göre filtrelerken aramasız uçtan sayfalı veri çekip
**o sayfanın içinde** isimle filtreliyordu → aranan takım/oyuncu başka sayfadaysa
listede görünmüyordu.

**Yeni davranış:** Arama ve lig filtresi tek uçta, **sunucu tarafında tüm veri
kümesinde** çalışır (PostgreSQL `f_unaccent` + benzerlik sıralaması). Sonuç hangi
"sayfada" olursa olsun bulunur.

| Yanlış (eski) | Doğru (yeni) |
|---------------|--------------|
| `GET /api/teams/by-league/:id` → gelen 20 kaydı client'ta `name.includes()` ile filtrele | `GET /api/teams?leagueId=:id&search=<metin>` → backend filtreler, tüm DB'de arar |
| Sayfa değiştikçe arama "kayboluyor" | `search` query param; her sayfada geçerli |

---

## 2. Ortak zarf & parametreler

Tüm sayfalı uçlar:
```jsonc
{ "items": [ … ], "page": 1, "pageSize": 20, "totalCount": 137, "totalPages": 7 }
```

| Param | Default | Sınır |
|-------|---------|-------|
| `page` | `1` | ≥1 |
| `pageSize` | `20` | 1–100 |
| `sort` | uca göre | `alan` / `-alan` |

Panel tablolarında: sayfa boyutu seçici (20/50/100), sayfa gezgini `totalPages`'ten,
toplam satır `totalCount`'tan.

---

## 3. Yönetim listeleri — hangi uç?

### Transferler
`GET /api/transfers` — tam filtre seti:

| Param | Açıklama |
|-------|----------|
| `leagueId` | **YENİ** — lig (kaynak/hedef takım) |
| `teamId` | **YENİ** — iki taraftan biri |
| `fromTeamId` / `toTeamId` / `playerId` | Belirli ilişki |
| `feeMin` / `feeMax`, `dateFrom` / `dateTo`, `currency` | Aralık/eşitlik |
| `sort` | `createdAt` (default), `transferDate`, `feeAmount` (`-feeAmount` = en pahalı) |

```
# Bir ligin en pahalı transferleri (panel pano)
GET /api/transfers?leagueId=<id>&sort=-feeAmount&page=1&pageSize=50
```

### Takımlar
`GET /api/teams?leagueId=&search=&page=&pageSize=`
- `leagueId` **veya** `search` zorunlu — yoksa **boş** döner (tüm takım dökümü yok).
- Takım seçtirme bileşeni: lig seç → `?leagueId=` ile takımları getir, kullanıcı
  yazdıkça `&search=` ekle.

### Oyuncular
`GET /api/players?leagueId=&teamId=&nationality=&positionId=&isFree=&search=&page=&pageSize=`
- En az bir filtre zorunlu — yoksa **boş** döner.

### Ligler
`GET /api/leagues?page=&pageSize=` — sayfalı (filtresiz tüm ligler olur; lig sayısı azdır).

---

## 4. Tipik panel akışları

**Takım yönetimi ekranı**
```
1) Lig dropdown'u:   GET /api/leagues?pageSize=100
2) Lig seçildi:      GET /api/teams?leagueId=<id>&pageSize=50
3) Arama kutusu:     GET /api/teams?leagueId=<id>&search=<metin>&page=1
4) Düzenle/Sil:      PUT/DELETE /api/admin/teams/:id   (Bearer + Admin)
```

**Oyuncu yönetimi ekranı**
```
1) Lig + (ops.) takım filtresi: GET /api/players?leagueId=<id>&teamId=<id>&page=1
2) Global oyuncu arama:         GET /api/players?search=<isim>&page=1
3) Düzenle/Sil:                 PUT/DELETE /api/admin/players/:id
```

**Transfer yönetimi ekranı**
```
1) Lig/takım filtreli liste: GET /api/transfers?leagueId=<id>&page=1&pageSize=50
2) En pahalıya göre sırala:  &sort=-feeAmount
3) Oluştur/Güncelle/Sil:     POST/PUT/PATCH/DELETE /api/admin/transfers
```

> Admin yazma uçları (`/api/admin/*`) `Bearer` token + `Admin` rolü ister; listeleme
> public uçlardan yapılır.

---

## 4.1. Arama & kaynak filtreleri (YENİ)

Backend desteği olmadığı için panelden kaldırılan **arama** ve **kaynak çipleri**
artık server-side — geri eklenebilir.

**Transferler & söylentiler** (`GET /api/transfers`, `GET /api/rumours`):
- `search` — oyuncu adı (aksan-duyarsız)
- `source` — `Manual` / `ApiSports` / `Bot` (sabit enum → çipler hazır)
- `leagueId` / `teamId` (rumours'a da eklendi)

```
GET /api/transfers?search=<oyuncu>&source=ApiSports&leagueId=<id>&page=1
```

**Haberler** (`GET /api/news`):
- `search` — başlık araması (aksan-duyarsız)
- `sourceName` — kaynak adı tam eşleşme
- Çip listesi: `GET /api/news/sources` → `{ items: string[] }` (distinct kaynaklar)

```
GET /api/news/sources                          # çipleri kur
GET /api/news?sourceName=<kaynak>&search=<metin>&page=1
```

> Çipleri client'ta sabit gömme: transfer kaynağı sabit enum (3 değer), haber
> kaynağı `GET /api/news/sources`'tan dinamik gelir.

---

## 5. ⚠️ BREAKING — panelde yapılması gerekenler

| Değişim | Aksiyon |
|---------|---------|
| Liste uçları tek sayfa döner | Server-side pagination'a geç (`page`/`pageSize`); client-side "hepsini çek + filtrele" mantığını kaldır |
| `teams`/`players` filtresiz boş | Ekran açılışında lig seçtir; seçim/arama olmadan istek atma |
| Arama server-side | Arama kutusunu `?search=` query'sine bağla; tablo içi JS filtrelemeyi sil |
| `by-league`, takım transfer uçları sayfalı | `page`/`pageSize` ekle |

---

## 6. Diğer panel listeleri (durum)

| Uç | Durum |
|----|-------|
| `GET /api/admin/audit-logs` | ✅ Zaten sayfalı + filtreli |
| `GET /api/admin/broadcast/broadcasts` | ✅ Zaten sayfalı |
| `GET /api/admin/currency-rates` | ✅ Zaten sayfalı |
| `GET /api/admin/transfers/periods` | Sayfasız `{ items }` — ama doğal sınırlı (yılda birkaç dönem) |
| `admin/transfers·teams·leagues·players` | Sadece yazma; liste yok (public uçları kullan) |
