# TransferPulse Back Office — Waitlist & Lansman Gönderimi

> Bu doküman back office (admin panel) frontend'inin **waitlist lansman** ekranını
> bağlaması için gereken her şeyi içerir. Kaynak sözleşme: `openapi.json` (**v1.4.0**).
> Temel auth / zarf / hata kuralları için ana rehbere bakın:
> [`BACKOFFICE-API-INTEGRATION.md`](./BACKOFFICE-API-INTEGRATION.md).

> **TL;DR:** Landing page'den toplanan e-postalara, uygulama yayına çıktığında tek
> tuşla **lansman duyuru e-postası** gönderilir. Panelden **`POST /api/admin/waitlist/launch`**
> çağrılır → iş **kuyruğa alınır** (anında dönmez), arka planda **sıralı** gönderilir.
> İlerleme **`GET /api/admin/waitlist/launches`** ile poll edilir, özet sayılar
> **`GET /api/admin/waitlist/stats`** ile gösterilir. Hepsi **Bearer + Admin** ister,
> tetikleme audit log'a `waitlist.launch` olarak düşer.

---

## 1. Temel Bilgiler

| | |
|---|---|
| **Base URL (dev)** | `http://localhost:8080` |
| **Auth** | `Authorization: Bearer <accessToken>` — `role: "Admin"` zorunlu |
| **Content-Type** | `application/json` |
| **Contract** | `openapi.json` → `info.version` = `1.4.0` |

> Admin olmayan token → `403`. Auth akışı (login/refresh/ban davranışı) ana rehberde.

---

## 2. Akışın Mantığı (önce bunu oku)

1. Ziyaretçiler landing page'den e-posta bırakır → `waitlist_subscribers` tablosu dolar
   (bu uç **landing** tarafındadır, panelde değil — bkz. landing rehberi).
2. Uygulama yayına çıkınca admin panelden **lansman** tetikler.
3. Backend bir **kampanya kaydı** (`LaunchCampaign`) oluşturur ve işi **BullMQ
   kuyruğuna** atar. İstek **`202 Accepted`** ile **hemen** döner — e-postalar
   o anda gönderilmez.
4. Bir worker aboneleri 100'lük gruplar halinde gezer ve her birine **sıralı**
   (sağlayıcı rate-limit'ine saygılı) e-posta gönderir.
5. **Idempotent:** gönderilen her abone işaretlenir. Aynı kampanya tekrar
   tetiklenir ya da yarıda kalıp yeniden denenirse **sadece kalanlar** gönderilir —
   kimseye iki kez mail gitmez.

> **Panel UX notu:** `launch` çağrısı `202` döner ve `status: "Queued"`'dur.
> "Gönderildi" demek için yanıtı bekleme — **`launches` ucunu poll et**, `status`
> `Done` olana kadar ilerlemeyi (`sentCount / total`) göster.

---

## 3. Lansmanı Tetikle

### `POST /api/admin/waitlist/launch`  *(Bearer + Admin)*

İstek gövdesi:

```jsonc
{
  "subject": "TransferPulse yayında! 🚀",   // zorunlu, ≤ 200 karakter
  "body": "Beklediğin an geldi — uygulama artık canlıda.", // zorunlu, ≤ 2000
  "ctaLabel": "Hemen keşfet",                // opsiyonel, ≤ 80
  "ctaUrl": "https://transferpulse.app/kesfet" // opsiyonel, geçerli URL, ≤ 500
}
```

Yanıt **`202 Accepted`** (zarflı — `{ data }`):

```jsonc
{
  "data": {
    "id": "uuid",                 // kampanya id — poll için sakla
    "subject": "TransferPulse yayında! 🚀",
    "body": "...",
    "ctaLabel": "Hemen keşfet",
    "ctaUrl": "https://transferpulse.app/kesfet",
    "status": "Queued",           // Queued | Sending | Done | Failed
    "total": 1180,                // hedef abone sayısı (o anki subscribed + gönderilmemiş)
    "sentCount": 0,               // başlangıçta 0
    "createdBy": "admin-uuid",
    "createdAt": "2026-06-10T12:30:00.000Z"
  }
}
```

**Davranış / dikkat:**
- `total`, **tetikleme anındaki** `subscribed` + henüz gönderilmemiş abone sayısıdır.
- `@Throttle` **adminBulk** policy'si (10/dk) uygulanır — yanlışlıkla spam tetiklemeyi sınırlar.
- Çift tıklama / tekrar tetik **güvenli**: idempotency sayesinde aynı abonelere
  ikinci kez gönderilmez. Yine de UI'da tetik butonunu işlem sırasında **disable** et.

---

## 4. İlerleme / Geçmiş (poll et)

### `GET /api/admin/waitlist/launches?page=1&pageSize=20`  *(Bearer + Admin)*

Yanıt `200` — **sayfalı zarf** (`PagedResult`):

```jsonc
{
  "items": [
    {
      "id": "uuid",
      "subject": "TransferPulse yayında! 🚀",
      "body": "...",
      "ctaLabel": "Hemen keşfet",
      "ctaUrl": "https://transferpulse.app/kesfet",
      "status": "Sending",     // canlı durum
      "total": 1180,
      "sentCount": 640,        // ilerleme → %54
      "createdBy": "admin-uuid",
      "createdAt": "2026-06-10T12:30:00.000Z"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "totalCount": 3,
  "totalPages": 1
}
```

**Status anlamları:**

| `status` | Anlam | UI |
|---|---|---|
| `Queued` | Kuyrukta, henüz başlamadı | "Sırada" + spinner |
| `Sending` | Gönderim sürüyor | İlerleme çubuğu `sentCount / total` |
| `Done` | Tamamlandı | ✓ "Gönderildi (`sentCount` kişi)" |
| `Failed` | Beklenmedik hata (kuyruk yeniden dener) | ⚠ + tekrar tetikleme öner |

> **Polling önerisi:** tetik sonrası en üstteki kampanyayı 3–5 sn'de bir poll et;
> `status` `Done`/`Failed` olunca durdur. (Gerçek zamanlı push yok — SSE/WS bu
> projede kapalı.) Tek bir alıcıda gönderim hatası kampanyayı **Failed yapmaz**;
> o e-posta atlanır, loglanır, kalanlar gönderilmeye devam eder.

---

## 5. Özet Kart (`stats`)

### `GET /api/admin/waitlist/stats`  *(Bearer + Admin)*

Yanıt `200` (zarflı — `{ data }`):

```jsonc
{
  "data": {
    "total": 1250,        // toplam kayıt
    "subscribed": 1180,   // aktif abone
    "unsubscribed": 70,   // abonelikten çıkan (List-Unsubscribe / unsubscribe ucu)
    "launchSent": 900     // lansman maili gönderilmiş abone
  }
}
```

Panel dashboard'unda kart olarak gösterilebilir; "Lansmana hazır alıcı" ≈
`subscribed - launchSent` (henüz mail gitmemiş aktif abone).

---

## 6. Hatalar

Global hata zarfı (ana rehberdeki ile aynı):

```jsonc
{
  "success": false,
  "message": "Doğrulama hatası",
  "errors": [ /* alan bazlı */ ],
  "statusCode": 400,
  "path": "/api/admin/waitlist/launch",
  "timestamp": "..."
}
```

| Durum | `statusCode` | Sebep |
|---|---|---|
| Geçersiz body (boş subject, body > 2000, geçersiz ctaUrl) | `400` | DTO validation |
| Token yok / geçersiz | `401` | Bearer eksik |
| Admin değil | `403` | rol yetersiz |
| Çok sık tetik | `429` | adminBulk throttle (10/dk) |

---

## 7. Önerilen Panel Ekranı (özet)

```
┌─ Waitlist ─────────────────────────────────────────────┐
│  Toplam: 1250   Abone: 1180   Çıkan: 70   Gönderilen:900│  ← GET /stats
├────────────────────────────────────────────────────────┤
│  [ Lansman Duyurusu Gönder ]  ← modal: subject/body/cta │  ← POST /launch
│                                                          │
│  Geçmiş kampanyalar:                                     │  ← GET /launches (poll)
│   • "TransferPulse yayında!"  Sending  640/1180 ▓▓▓░░    │
│   • "Beta davet"              Done     320/320  ✓        │
└──────────────────────────────────────────────────────────┘
```

**Akış:** modal'da formu doldur → `POST /launch` → `202` + kampanya id → modal kapat,
geçmiş listesini poll etmeye başla → `status: Done` olunca toast + polling durdur.
