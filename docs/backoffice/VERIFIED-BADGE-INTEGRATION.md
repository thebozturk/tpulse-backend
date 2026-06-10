# TransferPulse Back Office — Doğrulama Rozeti (Mavi/Sarı Tik) Yönetimi

> Bu doküman back office (admin panel) frontend'inin **doğrulama rozeti** (verified
> account / tik) yönetimini bağlaması için gereken tüm bilgiyi içerir. Kaynak sözleşme:
> `openapi.json` (**v1.3.0**). Temel auth/zarf/hata kuralları için ana rehbere bakın:
> [`BACKOFFICE-API-INTEGRATION.md`](./BACKOFFICE-API-INTEGRATION.md).

> **TL;DR:** Admin bir kullanıcıya **Blue** (onaylı kullanıcı) veya **Gold** (onaylı
> marka/resmi) tiki atayabilir ya da **kaldırabilir** — tek uç:
> **`PATCH /api/admin/users/:id/verify`**. Kullanıcı liste/detay yanıtlarına yeni
> **`verificationType`** (ve detayda `verifiedAt`) alanı eklendi. Tüm bu işlemler
> **Bearer + Admin** ister ve audit log'a `user.verify` olarak düşer.

---

## 1. Rozet Türleri

```ts
type VerificationType = 'Blue' | 'Gold';   // null = rozetsiz
```

| Değer | Renk | Kime verilir |
|---|---|---|
| `"Blue"` | 🔵 Mavi | Onaylı **kullanıcı** — muhabir, tanınmış kişi |
| `"Gold"` | 🟡 Sarı | Onaylı **marka / resmi** hesap — kulüp, sponsor, TransferPulse |
| `null` | — | Rozet yok (varsayılan) |

---

## 2. Rozet Ata / Değiştir / Kaldır

### `PATCH /api/admin/users/:id/verify`  *(Bearer + Admin)*

İstek gövdesi — `verificationType` **zorunlu**, ya geçerli bir tür ya da açıkça `null`:

```jsonc
// Mavi tik ver (veya Gold→Blue değiştir):
{ "verificationType": "Blue" }

// Sarı tik ver:
{ "verificationType": "Gold" }

// Tiki kaldır:
{ "verificationType": null }
```

Yanıt `200` → güncellenmiş kullanıcı detayı (zarflı):

```jsonc
{
  "data": {
    "id": "uuid",
    "username": "transfermarkt_tr",
    "email": "...",
    "nickname": "Transfermarkt TR",
    "role": "User",
    "status": "Active",
    "verificationType": "Gold",                 // güncel değer
    "verifiedAt": "2026-06-10T12:30:00.000Z",   // atandığında damgalanır; kaldırınca null
    "reputationScore": 0,
    "isMailConfirm": true,
    "createdAt": "...",
    "updatedAt": "2026-06-10T12:30:00.000Z"
  }
}
```

**Davranış:**
- Tür atanınca `verifiedAt` **o ana** set edilir; `null` gönderince `verifiedAt` de `null` olur.
- Türler arası geçiş (Blue↔Gold) tek istekle yapılır — yeni tür gönder yeter.
- İdempotent değil ama zararsız: aynı türü tekrar göndermek `verifiedAt`'i tazeler.

**Hatalar:**

| Kod | Sebep |
|---|---|
| `400` | `verificationType` eksik / geçersiz değer (`"Blue"`/`"Gold"`/`null` dışında) |
| `401` | Token yok / süresi dolmuş → refresh dene |
| `403` | Admin değil (veya hesap banlı/askıda) |
| `404` | Kullanıcı bulunamadı |
| `429` | Rate limit (mutating uç) |

> **Dikkat:** Gövdeye **fazladan alan ekleme** (`forbidNonWhitelisted` → `400`). Sadece
> `verificationType` gönder. Tiki kaldırmak için alanı **boş geçme**, açıkça `null` gönder.

---

## 3. Rozetin Göründüğü Yerler (liste & detay)

`verificationType` artık kullanıcı yanıtlarına eklenmiştir (non-breaking):

#### `GET /api/admin/users?...` → `Paged<User>`
Liste satırında rozeti göstermek için `user.verificationType` kullan.

#### `GET /api/admin/users/:id` → `{ data: UserDetail }`
Detayda hem `verificationType` hem `verifiedAt` (rozetin verildiği an) gelir.

**Güncellenmiş tipler** (ana rehberdeki `User`/`UserDetail`'e ekleme):
```ts
type VerificationType = 'Blue' | 'Gold';

interface User {
  id: string; username: string; email: string; nickname: string;
  profilePic?: string; isMailConfirm: boolean; status: UserStatus;
  favouriteTeam?: string; reputationScore: number; role: UserRole;
  verificationType: VerificationType | null;   // ← YENİ
  createdAt: string;
}
interface UserDetail extends User {
  bannedAt?: string; banReason?: string; updatedAt?: string;
  verifiedAt?: string;                           // ← YENİ (rozet atandığında dolu)
}
```

> Login yanıtındaki `user` objesi de artık `verificationType` taşır — admin'in kendi
> rozetini göstermek istersen oradan da okuyabilirsin.

---

## 4. Audit Log

Her rozet değişikliği audit log'a yazılır:

- **Action:** `user.verify`  (mevcut katalog: `user.status`, `user.role`, `user.reputation`, … + **yeni** `user.verify`)
- `GET /api/admin/audit-logs?action=user.verify` ile filtrelenebilir.
- `targetType: "User"`, `targetId: <kullanıcı id>`; aktör = işlemi yapan admin.

---

## 5. Panel UI Önerisi

Kullanıcı detay (ve/veya liste satır aksiyon) ekranında **"Doğrulama"** kontrolü:

```
Doğrulama rozeti:  ( ) Yok    (•) Mavi (onaylı kullanıcı)    ( ) Sarı (onaylı marka)
                   [ Kaydet ]
```

- Üç seçenekli radio/segment: **Yok / Mavi / Sarı** → sırasıyla `null` / `"Blue"` / `"Gold"`.
- "Kaydet" → `PATCH /api/admin/users/:id/verify` ile seçili değeri gönder.
- Mevcut değeri `user.verificationType`'tan ön-seç; `verifiedAt` varsa "X tarihinde verildi" göster.
- Liste satırında ad yanında küçük renkli tik ikonu (null → ikon yok).

Sözde-kod:
```ts
async function setVerification(userId: string, type: 'Blue' | 'Gold' | null) {
  return api<Single<UserDetail>>(`/api/admin/users/${userId}/verify`, {
    method: 'PATCH',
    body: JSON.stringify({ verificationType: type }),
  });
}
```

> `api()` wrapper'ı için ana rehbere bakın (401→refresh, 403→logout, zarf çözme).

---

## 6. Hızlı Referans

| Method | Path | Auth | Gövde |
|---|---|---|---|
| PATCH | `/api/admin/users/:id/verify` | Admin | `{ "verificationType": "Blue" \| "Gold" \| null }` |

İlgili (rozet alanını içeren mevcut uçlar):

| Method | Path | Not |
|---|---|---|
| GET | `/api/admin/users` | `Paged<User>` — satırda `verificationType` |
| GET | `/api/admin/users/:id` | `UserDetail` — `verificationType` + `verifiedAt` |
| GET | `/api/admin/audit-logs?action=user.verify` | Rozet değişiklik geçmişi |

---

## 7. Entegrasyon Kontrol Listesi

- [ ] `User`/`UserDetail` tiplerine `verificationType` (+ detayda `verifiedAt`) ekle.
- [ ] Kullanıcı detayda **Yok / Mavi / Sarı** seçici → `PATCH .../verify`.
- [ ] Kaldırma = açıkça `{ "verificationType": null }` gönder (alanı boş geçme).
- [ ] Liste satırında ad yanında renkli tik ikonu (null → gösterme).
- [ ] Gövdeye **fazladan alan ekleme** (400 olur).
- [ ] (Opsiyonel) Audit log ekranında `user.verify` aksiyonunu etiketle ("Rozet değişikliği").
- [ ] Tipleri `openapi.json` (v1.3.0)'dan üretip senkron tut.

---

## 8. OpenAPI

Uç ve şekiller `openapi.json` **v1.3.0**'da tanımlı (Swagger UI: `/swagger`).
Yeni rozet türü veya ek davranış ihtiyacı olursa backend ekibine yaz.
