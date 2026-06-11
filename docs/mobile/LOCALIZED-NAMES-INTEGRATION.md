# TransferPulse — Türkçe İsim (Lokalizasyon) Mobil Entegrasyonu

Bu belge, backend'e eklenen **takım / lig / oyuncu adı lokalizasyonu** özelliğinin
mobil app entegrasyonunu anlatır. API-Football'dan gelen isimler İngilizce; artık
her isim için opsiyonel bir **Türkçe karşılık** (`nameTr`) tutuluyor ve response'lar
isteğin diline göre Türkçe ya da İngilizce dönüyor.

> **TL;DR:** İstek attığın her yere **`Accept-Language: tr`** header'ı ekle. Bundan
> sonra `name`, `fullName`, `teamName`, `fromTeamName`, `toTeamName` gibi **mevcut
> alanların DEĞERİ** otomatik Türkçe gelir (Türkçesi yoksa İngilizce'ye düşer).
> **Yeni endpoint yok, alan adı değişmedi, parser'ın bozulmaz.** Header göndermezsen
> varsayılan zaten **Türkçe**. Tek yapman gereken: header'ı her isteğe koymak.

---

## 1. Tek değişiklik: `Accept-Language` header

Tüm API isteklerine dil header'ı ekle:

```
Accept-Language: tr      # Türkçe isimler (önerilen — uygulama dili Türkçe ise)
Accept-Language: en      # İngilizce (canonical) isimler
```

| Header | Dönen isim |
|---|---|
| `Accept-Language: tr` | Türkçe (`nameTr` varsa), yoksa İngilizce'ye düşer |
| `Accept-Language: en` | İngilizce (kanonik) |
| **header yok** | **Türkçe** (varsayılan) |

> Header'ı app'in dil ayarına bağla. Cihaz/uygulama dili Türkçe → `tr`, değilse `en`.
> İleride 3. bir dil eklenirse aynı mekanizma genişler; bugün `tr`/`en`.

İstemci tarafında genelde HTTP client'a global bir interceptor ile eklenir
(örnek Dart/Retrofit/OkHttp fark etmez — fikir aynı):

```dart
// Pseudo — her isteğe otomatik dil header'ı
dio.options.headers['Accept-Language'] = appLocale == 'tr' ? 'tr' : 'en';
```

---

## 2. Hangi alanların değeri lokalize oluyor?

**Alan adları aynı kalıyor** — sadece içindeki **string değer** dile göre değişiyor.
Aşağıdaki tüm uçlar etkilenir:

| Modül | Endpoint (örnek) | Lokalize olan alan(lar) |
|---|---|---|
| Takımlar | `GET /api/teams`, `GET /api/teams/:id` | `name`, `leagueName`, kadro oyuncularının `fullName` |
| Ligler | `GET /api/leagues`, `GET /api/leagues/:code` | `name` |
| Oyuncular | `GET /api/players`, `GET /api/players/:id` (profil) | `firstName`, `lastName`, `fullName`, `teamName` |
| Transferler | `GET /api/transfers...` ve istatistikler | oyuncu adı, `fromTeamName`, `toTeamName`, takım adları |
| Haberler | `GET /api/news...` | `playerName`, `fromTeamName`, `toTeamName` (başlık/içerik **editöryel**, çevrilmez) |
| Gönderiler | `GET /api/posts...` | `playerName`, `teamName`, `fromTeamName`, `toTeamName` (post `content` çevrilmez) |
| Feed | `GET /api/feed/for-you` | post içindeki takım/oyuncu adları |
| Arama | `GET /api/search` | takım / lig / oyuncu sonuç adları |

```jsonc
// GET /api/teams/:id  —  Accept-Language: tr
{
  "id": "uuid",
  "name": "Bayern Münih",        // ← değer Türkçe geldi (en: "Bayern Munich")
  "leagueName": "Bundesliga",
  "playerCount": 27
  // ... diğer alanlar aynen
}
```

```jsonc
// Aynı uç  —  Accept-Language: en
{
  "id": "uuid",
  "name": "Bayern Munich",       // ← İngilizce (kanonik)
  "leagueName": "Bundesliga",
  "playerCount": 27
}
```

---

## 3. Yeni (opsiyonel) ham alanlar — mobilde KULLANMANA GEREK YOK

Admin paneli için response'lara ham Türkçe alanlar da eklendi:
`nameTr` (takım/lig), `firstNameTr` / `lastNameTr` (oyuncu). Bunlar **opsiyonel** ve
**admin amaçlı**. Mobil bunları **görmezden gelir** — sen sadece lokalize olmuş
`name` / `fullName` alanlarını okumaya devam et.

```jsonc
// Mobil bu iki alanı render etmez:
{
  "name": "Bayern Münih",
  "nameTr": "Bayern Münih"   // ← admin/panel için ham değer; mobil yok say
}
```

---

## 4. Yapılacaklar (mobil checklist)

- [ ] HTTP client'a global `Accept-Language` header'ı ekle (app diline bağlı: `tr`/`en`).
- [ ] Başka **hiçbir** parser değişikliği gerekmiyor — `name`/`fullName`/`teamName` alanlarını aynen okumaya devam et.
- [ ] (Opsiyonel) Uygulama içi dil değiştirme varsa, dil değişince isimle ilgili cache/listeleri tazele (yeni dil için yeni değerler gelir).

## 5. Sık sorulanlar

**S: Header göndermezsem ne olur?**
Türkçe döner (varsayılan `tr`). Yine de açıkça göndermen önerilir.

**S: Bir takımın Türkçesi girilmemişse?**
`Accept-Language: tr` olsa bile o takımda İngilizce ada düşülür — boş/null dönmez.

**S: Eski app sürümleri bozulur mu?**
Hayır. Alan adları değişmedi, alan eklemek non-breaking. Header göndermeyen eski
sürüm Türkçe değer alır.

**S: Başlık/içerik/şehir gibi alanlar da çevrildi mi?**
Hayır — sadece **varlık adları** (takım/lig/oyuncu). Haber başlığı, post içeriği,
stadyum/şehir adı gibi alanlar olduğu gibi kalır.
