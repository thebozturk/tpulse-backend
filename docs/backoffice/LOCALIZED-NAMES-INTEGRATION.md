# TransferPulse — Türkçe İsim Yönetimi (Panel) Entegrasyonu

Bu belge, **takım / lig / oyuncu adlarının Türkçe karşılıklarını** panelden
düzenleme entegrasyonunu anlatır. API-Football'dan gelen isimler İngilizce
(`Bayern Munich`, `Inter`, ...). Artık her varlığın bir **İngilizce kanonik adı**
(`name`) bir de **düzenlenebilir Türkçe adı** (`nameTr`) var. Mobil, kullanıcının
diline göre Türkçe adı gösterir; **Türkçe adı doğru girmek panelin işi.**

> **TL;DR:** Panelde takım/lig/oyuncu düzenleme formuna **Türkçe ad alanı** ekle.
> Okurken admin isteklerini **`Accept-Language: en`** ile at → `name` (İngilizce,
> read-only) + `nameTr` (Türkçe, düzenlenebilir) birlikte gelir. Yazarken mevcut
> `PUT` body'sine `nameTr`'yi ekle. **Senkron (API-Football) bu Türkçe adı asla
> ezmez** — bir kez girdin mi kalıcıdır.

---

## 1. Model: iki isim alanı

| Alan | Kaynak | Düzenlenebilir mi? | Anlam |
|---|---|---|---|
| `name` | API-Football (İngilizce) | ❌ (senkron yönetir) | Kanonik İngilizce ad |
| `nameTr` | Panel (admin) | ✅ | Türkçe gösterim adı |

Oyuncuda ad/soyad ayrı olduğu için **iki** Türkçe alan var: `firstNameTr`, `lastNameTr`.

> Yeni takım/oyuncu/lig ilk senkronda `nameTr = name` (İngilizce) ile **önceden
> doldurulur** — yani form hiçbir zaman boş gelmez, admin sadece düzeltir.

---

## 2. Okuma: iki alanı da göster (`Accept-Language: en`)

Admin'e özel GET ucu **yok**; panel mevcut public uçları kullanır. Kanonik İngilizce
adı görebilmek için admin okuma isteklerini **`Accept-Language: en`** ile at:

| Varlık | Okuma ucu |
|---|---|
| Takım | `GET /api/teams`, `GET /api/teams/:id` |
| Lig | `GET /api/leagues`, `GET /api/leagues/:code` |
| Oyuncu | `GET /api/players`, `GET /api/players/:id` |

`en` ile çağırınca `name` = İngilizce kanonik; `nameTr` (ham) ayrıca gelir:

```jsonc
// GET /api/teams/:id   (Accept-Language: en)
{
  "id": "uuid",
  "name": "Bayern Munich",     // ← İngilizce kanonik (read-only, formda kilitli göster)
  "nameTr": "Bayern Münih",    // ← Türkçe (düzenlenebilir alan)
  "leagueId": "uuid",
  "leagueName": "Bundesliga",
  "playerCount": 27
}
```

```jsonc
// GET /api/players/:id   (Accept-Language: en)
{
  "id": "uuid",
  "firstName": "Joshua",       // İngilizce (read-only)
  "lastName": "Kimmich",
  "firstNameTr": "Joshua",     // Türkçe (düzenlenebilir)
  "lastNameTr": "Kimmich",
  "teamName": "Bayern Munich"
}
```

> ⚠️ **Neden `en`?** `Accept-Language: tr` (veya header'sız) gönderirsen `name`
> alanı **Türkçeleşir** ve kanonik İngilizceyi göremezsin. Panelde İngilizce
> referansı görmek için admin okuma çağrılarında **mutlaka `en`** kullan.

---

## 3. Yazma: mevcut `PUT` body'sine Türkçe alanı ekle

Düzenleme uçları aynen duruyor; sadece body'ye yeni alan ekleniyor.

| Varlık | Yazma ucu | Eklenen alan |
|---|---|---|
| Takım | `PUT /api/admin/teams/:id` | `nameTr` |
| Lig | `PUT /api/admin/leagues/:id` | `nameTr` |
| Oyuncu | `PUT /api/admin/players/:id` | `firstNameTr`, `lastNameTr` |

```jsonc
// PUT /api/admin/teams/:id   (Authorization: Bearer <admin token>)
{
  "name": "Bayern Munich",     // PUT tam güncelleme → mevcut alanları da gönder
  "nameTr": "Bayern Münih",    // ← admin'in girdiği Türkçe ad
  "leagueId": "uuid"
}
```

```jsonc
// PUT /api/admin/players/:id
{
  "firstName": "Joshua",
  "lastName": "Kimmich",
  "firstNameTr": "Joshua",
  "lastNameTr": "Kimmich",
  "nationality": "Germany",
  "teamId": "uuid",
  "isFree": false
  // ... formdaki diğer mevcut alanlar
}
```

**Kurallar:**
- `nameTr` / `firstNameTr` / `lastNameTr` **opsiyonel** ve en fazla `name` ile aynı
  uzunlukta (takım 50, lig 30, oyuncu 32 karakter).
- Bu uçlar `PUT` (tam güncelleme) — formu kaydederken **tüm mevcut alanları** body'de
  gönder (sadece `nameTr`'yi değil). `name`/`leagueId` zorunlu kalır.
- Yetki: `Authorization: Bearer <admin token>`, rol `Admin`.

---

## 4. Senkronla ilişkisi (önemli)

API-Football senkronu (`POST /api/admin/sync/football-data`):

- **`name`'i günceller** (İngilizce kaynak değişirse yansır).
- **`nameTr` / `firstNameTr` / `lastNameTr`'ye ASLA dokunmaz.**

Yani admin bir kez "Bayern Münih" yazdıysa, sonraki her senkron bunu korur.
Yeni eklenen varlıklarda Türkçe alan İngilizce ile dolu başlar; admin diler düzeltir.

> Senkron tetikleme + audit için ayrıca bkz. `BACKOFFICE-BACKEND-ROADMAP.md` (Faz BO-5).

---

## 5. Önerilen panel UX

Düzenleme formunda iki satır:

| Etiket | Alan | Davranış |
|---|---|---|
| **İsim (varsayılan / EN)** | `name` | Read-only göster (senkron yönetir) |
| **Türkçe ad** | `nameTr` | Düzenlenebilir; boş bırakılırsa mobilde İngilizce'ye düşer |

- Liste ekranında istersen iki kolon göster: "Ad (EN)" ve "Türkçe ad".
- Türkçe alan İngilizce ile aynıysa (`Liverpool` = `Liverpool`) sorun yok — çeviri
  gerektirmeyen isimler öylece kalır; admin yalnız gerekenleri (`Bayern Münih`,
  `Inter`, `Münih`, vb.) düzeltir.

## 6. Yapılacaklar (panel checklist)

- [ ] Admin **okuma** çağrılarına `Accept-Language: en` ekle (kanonik `name` için).
- [ ] Takım/lig/oyuncu düzenleme formuna **Türkçe ad** alan(lar)ını ekle (`nameTr`; oyuncuda `firstNameTr` + `lastNameTr`).
- [ ] Kaydederken mevcut `PUT` body'sine bu alanları ekle (tam body gönder).
- [ ] (Opsiyonel) Liste ekranında "Ad (EN) / Türkçe ad" iki kolonu.
- [ ] Doğrulama: maxLength (takım 50 / lig 30 / oyuncu 32), opsiyonel alan.
