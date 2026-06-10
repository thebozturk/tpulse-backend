# TransferPulse — Mobil "Senin İçin" Feed & Sosyal Graf Entegrasyonu

Bu belge, backend'e eklenen **skorlanmış (X/Twitter tarzı) "Senin İçin" feed'i** ve
onu besleyen **sosyal özellikleri** (takip / engelle / sustur / kelime susturma)
mobil app entegrasyonunu anlatır. Backend kodu okumadan implement edebilmen için
tüm endpoint'ler, request/response şekilleri, davranış kuralları ve UI notları burada.

> **TL;DR:** Mevcut kronolojik `GET /api/posts` **aynen duruyor, değişmedi**. Yanına
> kişiye özel **`GET /api/feed/for-you`** geldi. Dönen obje birebir aynı
> `PostResponseDto` → **mevcut post hücre UI'ın olduğu gibi çalışır**, sadece yeni bir
> sekme/kaynak. Ek olarak takip/engelle/sustur uçları ve "kelime susturma" var.
> Tüm yeni uçlar **JWT (Bearer) zorunlu**.

> ⚠️ **En kritik davranış:** "Senin İçin" feed'i **offset pagination DEĞİL**. Sayfayı
> artırma (`page=2,3…`) yerine **her seferinde `page=1` çağır** — backend daha önce
> gösterdiklerini (served) otomatik eler ve **bir sonraki taze partiyi** döner.
> Detay: [§4](#4-feedi-sayfalama--önemli).

---

## 1. Genel Bakış

| Özellik | Endpoint | Not |
|---|---|---|
| Senin İçin feed | `GET /api/feed/for-you` | Skorlu, kişisel; favori + takip + keşif birleşimi |
| Takip et / bırak | `POST` / `DELETE /api/users/{id}/follow` | |
| Takip ettiklerim | `GET /api/me/following` | id listesi döner |
| Engelle / kaldır | `POST` / `DELETE /api/users/{id}/block` | Feed'de o yazar gizlenir |
| Sustur / kaldır | `POST` / `DELETE /api/users/{id}/mute` | Feed'de o yazar gizlenir |
| Kelime sustur | `GET` / `POST /api/me/muted-keywords`, `DELETE /api/me/muted-keywords/{id}` | İçerikte kelime geçen post gizlenir |

Backend bu feed'i şöyle üretir (mobilin bilmesi şart değil, ama UX kararları için faydalı):

```
Kaynaklar:  favori oyuncu/takım/haberci postları  +  takip ettiğin kullanıcılar  +  keşif (global trend)
Filtreler:  kendi postların · engel/sustur ettiğin yazarlar · susturduğun kelimeler · daha önce görülenler
Skor:       etkileşim(beğeni/oy/yorum) × tazelik × (takip/favori bonusu) − (rapor cezası), aynı yazar tekrarı söndürülür
Sonuç:      skora göre sıralı, kişiye özel feed
```

---

## 2. Kimlik Doğrulama

**Tüm bu uçlar korumalı** — her istekte access token gönder:

```
Authorization: Bearer <accessToken>
```

Token yoksa/expired → `401 Unauthorized`. (Token alımı/yenileme mevcut auth akışıyla aynı:
`POST /api/auth/login`, `POST /api/auth/refresh`.)

Base URL: prod `https://<API_DOMAIN>` · lokal `http://localhost:8080`.

---

## 3. Senin İçin Feed — `GET /api/feed/for-you`

### İstek

| Query | Tip | Zorunlu | Varsayılan | Açıklama |
|---|---|---|---|---|
| `page` | number | hayır | 1 | **Genelde 1 bırak** (bkz. §4) |
| `pageSize` | number (1–100) | hayır | 20 | Parti başına post sayısı |
| `seenIds` | string (virgüllü UUID) | hayır | — | Client'ta bu oturumda gördüğün post id'leri; bunlar da elenir (opsiyonel ek güvence) |

Örnek:
```
GET /api/feed/for-you?pageSize=20
GET /api/feed/for-you?pageSize=20&seenIds=7c9e6679-...,9b2d4f10-...
Authorization: Bearer <token>
```

### Yanıt — `200 OK`

Zarf: standart `PagedResult` (mevcut `/api/posts` ile birebir aynı):

```jsonc
{
  "items": [ /* PostResponseDto[] — aşağıda */ ],
  "page": 1,
  "pageSize": 20,
  "totalCount": 134,      // o an erişilebilir sıralı havuz boyutu (bilgi amaçlı)
  "totalPages": 7
}
```

> `totalCount`/`totalPages` bilgilendirme içindir; **sayfalama için ona güvenme** (bkz. §4).
> Boş feed → `items: []` (cold start ya da gösterilecek taze içerik kalmadı).

### `PostResponseDto` (her `items` elemanı)

`GET /api/posts`'taki ile **birebir aynı** — yani mevcut post hücresi/parser'ın değişmeden çalışır:

```jsonc
{
  "id": "uuid",
  "ownerId": "uuid",
  "ownerName": "string",
  "ownerPhoto": "string?",
  "isMailConfirm": true,
  "userRole": "User",
  "content": "string",
  "postType": 0,
  "playerId": "uuid?", "playerName": "string?", "playerNationality": "string?", "playerPhoto": "string?",
  "teamId": "uuid?", "teamName": "string?", "teamLogo": "string?",
  "fromTeamId": "uuid?", "fromTeamName": "string?", "fromTeamLogo": "string?",
  "toTeamId": "uuid?", "toTeamName": "string?", "toTeamLogo": "string?",
  "likeCount": 0, "isLiked": false,
  "isVotingEnabled": false, "agreeCount": 0, "disagreeCount": 0,
  "totalVotes": 0, "agreePercentage": 0, "disagreePercentage": 0, "userVote": null,
  "createdAtUtc": "2026-06-10T12:00:00.000Z",
  "commentCount": 0,
  "category": null, "imageUrl": null, "sourceUrl": null
}
```

`isLiked` / `userVote` istek sahibinin durumuna göre doldurulur (token'dan). Skor (`hotScore`)
**dışarı verilmez** — sıralama backend'de.

---

## 4. Feed'i Sayfalama — ⚠️ ÖNEMLİ

Bu feed **ranked + "daha önce gösterileni gösterme" (served dedup)** mantığıyla çalışır.
Backend, sana sunduğu post id'lerini **24 saat** boyunca hatırlar ve tekrar göndermez.

**Doğru kullanım — sonsuz kaydırma (infinite scroll):**

1. İlk yükleme / pull-to-refresh: `GET /api/feed/for-you?pageSize=20` (page yok = 1)
2. Kullanıcı sona yaklaşınca **yine `page=1`** ile çağır → backend **bir sonraki taze 20'yi** döner
3. `items` **boş gelene kadar** tekrarla (boş = şimdilik gösterilecek yeni içerik yok)
4. Sonuçları listene **append** et

```
loadMore():
  res = GET /api/feed/for-you?pageSize=20
  if res.items.isEmpty: hasMore = false
  else: feed.append(res.items)
```

❌ **YAPMA:** `page`'i 2,3,4… diye artırma. Served dedup ile offset birlikte **post atlatır**
(bazı postlar hiç görünmez). Ranked feed offset paginate edilmez.

**Pull-to-refresh:** Yine `page=1` çağır. Henüz görülmemiş yeni/taze postlar en üstte gelir.
Tüm feed'i baştan görmek (served sıfırlama) şu an mümkün değil; served kaydı 24 saatte
kendiliğinden sönümlenir. (İhtiyaç olursa backend'e "feed oturumu sıfırla" ucu eklenebilir — talep et.)

**`seenIds` ne zaman?** Backend zaten server-side dedup yapıyor; `seenIds` opsiyoneldir.
Aynı oturumda offline/yarım kalan kaydırmalarda ekstra güvence istersen, ekranda gösterdiğin
son N post id'sini virgüllü gönderebilirsin. Göndermezsen de feed doğru çalışır.

---

## 5. Takip — Follow

### Takip et — `POST /api/users/{id}/follow`
- Body yok. `{id}` = takip edilecek kullanıcının id'si.
- **201 Created** `{ "success": true }` → yeni takip kuruldu
- **200 OK** `{ "unchanged": true }` → zaten takip ediyordun
- **400** kendini takip → `{ message: "Kendini takip edemezsin", ... }`
- **404** kullanıcı yok

> Mobil: 201 ve 200'ü **ikisini de başarı** say (buton "Takip ediliyor" durumuna geçsin).

### Takibi bırak — `DELETE /api/users/{id}/follow`
- **200 OK** `{ "success": true }` (bıraktı) veya `{ "unchanged": true }` (zaten takip etmiyordun)

### Takip ettiklerim — `GET /api/me/following`
```jsonc
{ "items": ["uuid1", "uuid2"] }   // SADECE kullanıcı id listesi
```
> Profil bilgisi (isim/foto) gelmez — id'leri mevcut kullanıcı/profil uçlarıyla çöz.
> "Takip ediliyor mu?" rozetini bu listeyle eşleştir.

---

## 6. Engelle / Sustur — Block / Mute

İki ayrı uç, **feed davranışı aynı**: ikisi de o yazarın postlarını feed'den gizler.

| İşlem | Uç | Başarı |
|---|---|---|
| Engelle | `POST /api/users/{id}/block` | 201 `{success:true}` / 200 `{unchanged:true}` |
| Engeli kaldır | `DELETE /api/users/{id}/block` | 200 `{success:true}` / `{unchanged:true}` |
| Sustur | `POST /api/users/{id}/mute` | 201 `{success:true}` / 200 `{unchanged:true}` |
| Susturmayı kaldır | `DELETE /api/users/{id}/mute` | 200 `{success:true}` / `{unchanged:true}` |

- **400** kendini engelle/sustur · **404** kullanıcı yok.

> **Semantik (şu anki backend):** Block ve Mute'un **feed etkisi aynıdır** (yazar gizlenir).
> "Block daha güçlü" (DM engeli, profil gizleme vb.) gibi ekstra etkiler **henüz yok**.
> Mobil bu ikisini ayrı menü öğesi olarak sunabilir ama kullanıcıya block için ekstra
> yetenek **vaat etme**. İleride genişlerse bu belge güncellenir.

> **Anında yansıma:** Engelleme/susturma sonrası feed'i tazele (`page=1`) → o yazarın postları
> düşer. Zaten served olarak gösterilmiş kartları client tarafında da gizlemek istersen,
> listeden `ownerId == engellenenId` olanları çıkar.

---

## 7. Kelime Susturma — Muted Keywords

İçeriğinde (case-insensitive) bu kelimelerden biri geçen postlar feed'den elenir.

### Listele — `GET /api/me/muted-keywords`
```jsonc
{ "items": [ { "id": "uuid", "keyword": "sponsorlu" } ] }
```

### Ekle — `POST /api/me/muted-keywords`
```jsonc
// body
{ "keyword": "sponsorlu" }     // 2–100 karakter; backend trim + lowercase yapar
```
- **201 Created** `{ "id": "uuid", "keyword": "sponsorlu" }`
- **200 OK** `{ "unchanged": true }` → kelime zaten susturulmuş
- **400** validasyon (boş / 2 karakterden kısa / 100'den uzun)

### Sil — `DELETE /api/me/muted-keywords/{id}`
- **200 OK** `{ "success": true }` · **404** kelime yok

> Mobil: ayarlarda basit bir "Susturulan Kelimeler" listesi (ekle/sil). Kelime normalize
> edilerek (küçük harf, trim) saklanır → UI'da kullanıcı ne yazarsa yazsın eşleşir.

---

## 8. Hata Zarfı (tüm uçlar)

Global exception filter standart hata döner:
```jsonc
{
  "success": false,
  "message": "Kullanıcı bulunamadı",
  "statusCode": 404,
  "path": "/api/users/.../follow",
  "timestamp": "2026-06-10T12:00:00.000Z",
  "errors": []            // validasyon hatalarında alan detayları
}
```
Önemli kodlar: **401** (token yok/expired → refresh dene), **400** (validasyon / kendini hedefleme),
**404** (hedef yok), **429** (rate limit — mutating uçlarda).

---

## 9. Mobil Yapılacaklar Listesi (eklenecek / değişecek)

**Eklenecek**
- [ ] **"Senin İçin" sekmesi/kaynağı** → `GET /api/feed/for-you`. Hücre UI'ı mevcut post
      hücresiyle aynı (`PostResponseDto`) → yeniden kullan.
- [ ] **Infinite scroll mantığı**: `page=1` tekrar çağrısı + `items` boşalınca dur (§4).
      Offset pagination KULLANMA.
- [ ] **Takip butonu** profil/kullanıcı kartında → follow/unfollow; durum `GET /api/me/following`'den.
- [ ] **Post overflow menüsü** ("…"): "Kullanıcıyı engelle", "Kullanıcıyı sustur",
      (opsiyonel) "Bu kelimeyi sustur".
- [ ] **Ayarlar > Susturulan Kelimeler** ekranı (liste + ekle + sil).
- [ ] (Opsiyonel) İşlem sonrası client tarafı anlık gizleme (engellenen yazarın görünür kartlarını çıkar).

**Değişecek / Dikkat**
- [ ] Mevcut `GET /api/posts` (kronolojik) **dokunma** — yan yana yaşıyor. "Senin İçin" ayrı sekme.
- [ ] Tüm yeni uçlara **Authorization header** ekle.
- [ ] 201 ve 200'ü follow/block/mute'ta **ikisi de başarı** olarak ele al.

---

## 10. Hızlı Akış Örnekleri (sözde-kod)

```
// Senin İçin sekmesi — ilk açılış + load more
onOpen / onRefresh:        feed = []; load()
load():                    r = GET /api/feed/for-you?pageSize=20 (Bearer)
                           if r.items.empty: hasMore=false else feed.append(r.items)
onScrollNearEnd:           if hasMore: load()        // yine page=1!

// Takip
onTapFollow(userId):       POST /api/users/{userId}/follow → (201|200) ⇒ buton "Takip ediliyor"
onTapUnfollow(userId):     DELETE /api/users/{userId}/follow → buton "Takip et"

// Post menüsü
onBlock(ownerId):          POST /api/users/{ownerId}/block → feed'den ownerId kartlarını çıkar + refresh
onMuteUser(ownerId):       POST /api/users/{ownerId}/mute  → aynı
onMuteWord(word):          POST /api/me/muted-keywords {keyword:word} → refresh

// Ayarlar
listMutedWords():          GET /api/me/muted-keywords → items[{id,keyword}]
removeMutedWord(id):       DELETE /api/me/muted-keywords/{id}
```

---

## 11. OpenAPI

Tüm bu uçlar `openapi.json` **v1.2.0**'da tanımlı (Swagger UI: `/swagger`). Tip üretimi için
contract'ı oradan tüket — bu belgedeki şekiller openapi ile birebir uyumludur.

> Sorular / "feed oturumu sıfırla" gibi ek uç ihtiyaçları için backend ekibine yaz.
