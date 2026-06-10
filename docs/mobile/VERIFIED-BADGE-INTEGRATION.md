# TransferPulse — Mobil Doğrulama Rozeti (Mavi/Sarı Tik) Entegrasyonu

Bu belge, backend'e eklenen **doğrulama rozeti** (verified account / tik) özelliğinin
mobil app entegrasyonunu anlatır. Backend kodu okumadan implement edebilmen için alan
şekli, değerler ve UI kuralları burada.

> **TL;DR:** Kullanıcı taşıyan tüm response'lara (profil, feed postu, yorum) yeni bir
> **opsiyonel** alan eklendi: **`verificationType`**. Değeri `"Blue"`, `"Gold"` veya
> `null`. **Mobilde yeni endpoint çağırmana gerek yok** — rozet tamamen bu alandan
> render edilir. Tik **kimlere verilir** kararı backend/admin'dedir; mobil sadece
> gösterir. Mevcut parser'ların bozulmaz, yalnızca yeni alanı okursun.

---

## 1. Rozet Türleri

| `verificationType` | Renk | Anlam | Örnek |
|---|---|---|---|
| `"Blue"` | 🔵 Mavi tik | Onaylı kullanıcı | Muhabir, tanınmış kişi |
| `"Gold"` | 🟡 Sarı tik | Onaylı marka / resmi hesap | Kulüp, sponsor, TransferPulse resmi |
| `null` (veya alan yok) | — | Rozetsiz | Normal kullanıcı |

> İki tik aynı "doğrulanmış" ailesinden ama **görsel olarak ayrışmalı**: Blue = birey,
> Gold = kurum/marka. Renk dışında ikon aynı (onay/check) kalabilir.

---

## 2. Alan Nerede Geliyor?

`verificationType` **kullanıcıyı temsil eden her DTO'ya** eklendi. Hiçbir alan
kaldırılmadı/yeniden adlandırılmadı — sadece ekleme (non-breaking).

| Nerede | DTO | Alan |
|---|---|---|
| Profil / oturum kullanıcısı | `UserResponseDto` (login `user`, `/api/users/...`) | `verificationType` |
| Feed / post hücresi | `PostResponseDto` (`/api/posts`, `/api/feed/for-you`) | `verificationType` (= **post sahibinin** rozeti) |
| Yorum hücresi | `CommentDto` (`/api/posts/{id}/comments`) | `verificationType` (= **yorum sahibinin** rozeti) |

```jsonc
// PostResponseDto (kısaltılmış) — yeni alan tek satır:
{
  "id": "uuid",
  "ownerId": "uuid",
  "ownerName": "transfermarkt_tr",
  "ownerPhoto": "https://...",
  "isMailConfirm": true,
  "userRole": "User",
  "verificationType": "Gold",          // ← YENİ: "Blue" | "Gold" | null
  "content": "...",
  // ... diğer alanlar aynen duruyor
}
```

```jsonc
// CommentDto (kısaltılmış):
{
  "id": "uuid",
  "ownerId": "uuid",
  "ownerName": "ali_muhabir",
  "ownerPhoto": "https://...",
  "verificationType": "Blue",          // ← YENİ
  "content": "...",
  "likeCount": 3,
  "isLiked": false,
  "createdAtUtc": "2026-06-10T12:00:00.000Z",
  "replies": []
}
```

> **`userRole` ile karıştırma:** `userRole` (`"User"`/`"Admin"`) yetki içindir, rozet değil.
> Tik için **yalnızca `verificationType`** kullan.

---

## 3. UI Render Kuralı

Kullanıcı adının **yanına** (profilde, feed kartında, yorumda) rozeti çiz:

```
verificationType == null     → ikon yok
verificationType == "Blue"   → mavi tik ikonu
verificationType == "Gold"   → sarı/altın tik ikonu
```

Sözde-kod:
```
badgeFor(verificationType):
  switch verificationType:
    case "Blue": return blueCheckIcon
    case "Gold": return goldCheckIcon
    default:     return null   // null veya bilinmeyen değer → gösterme
```

> **İleri-uyumluluk:** Eğer ileride yeni bir tür eklenirse (ör. başka renk), mobil
> **bilinmeyen değerde rozet göstermemeli** (crash etme, default'a düş). `switch`'i
> her zaman `default: yok` ile kapat.

**Yerleşim önerisi:** İsmin hemen sağında, küçük (~14–16dp) ikon. Uzun isimlerde ikon
kırpılmasın — isim `ellipsize` olsa bile rozet görünür kalsın.

---

## 4. Kimlik Doğrulama / Çağrı Değişikliği

**Yeni endpoint YOK, header değişikliği YOK.** Rozeti zaten çağırdığın uçların
(`/api/posts`, `/api/feed/for-you`, yorum uçları, profil) yanıtından okursun. Mevcut
auth akışı aynen geçerli.

Tik **verme/kaldırma** işlemi yalnızca **admin panelindedir** (mobil yapmaz). Mobil
tarafı tamamen **salt-okunur gösterimdir**.

---

## 5. Mobil Yapılacaklar Listesi

**Eklenecek**
- [ ] Model/parser: `User`, `Post`, `Comment` modellerine `verificationType?: "Blue" | "Gold" | null` ekle.
- [ ] Ortak bir **`VerifiedBadge`** view komponenti (renk = türe göre, null → render etme).
- [ ] Bu komponenti **feed kartı**, **yorum hücresi** ve **profil başlığı**ndaki isim yanına yerleştir.
- [ ] (Opsiyonel) Rozete dokununca küçük bilgi tooltip'i ("Onaylı hesap" / "Onaylı marka").

**Dikkat**
- [ ] Alan **opsiyonel/nullable** — eski/rozetsiz kullanıcılarda `null` ya da hiç gelmeyebilir; null-safe oku.
- [ ] `switch` her zaman `default: rozet yok` ile kapansın (ileri-uyumluluk).
- [ ] Mevcut alanlar değişmedi — eski hücre kodu kırılmaz, yalnızca yeni alanı ekliyorsun.

---

## 6. OpenAPI

Tüm bu şekiller `openapi.json` **v1.3.0**'da tanımlı (Swagger UI: `/swagger`). Tipleri
contract'tan otomatik üretebilirsin — bu belgedeki şekiller openapi ile birebir uyumludur.

> Yeni rozet türü / ekstra davranış ihtiyacı (ör. rozete tıklayınca doğrulama detayı)
> olursa backend ekibine yaz.
