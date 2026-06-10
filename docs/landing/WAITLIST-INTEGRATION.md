# TransferPulse Landing — E-posta Toplama (Waitlist) Entegrasyonu

> Bu doküman **landing page** frontend'inin ziyaretçi e-postalarını toplamak için
> backend'e bağlanmasını anlatır. Kaynak sözleşme: `openapi.json` (**v1.4.0**).
> Toplanan e-postalara sonradan panelden lansman duyurusu gönderilir (bkz.
> [`../backoffice/WAITLIST-LAUNCH-INTEGRATION.md`](../backoffice/WAITLIST-LAUNCH-INTEGRATION.md)).

> **TL;DR:** Landing'deki "haberdar et" formu tek bir public uca POST atar:
> **`POST /api/waitlist`** body `{ email }`. Kullanıcı login'i / token **gerekmez**.
> Aynı e-posta tekrar gönderilse bile sorun olmaz (**idempotent** — kopya kayıt
> oluşmaz). Kötüye kullanım rate-limit ile sınırlanır.

---

## 1. Temel Bilgiler

| | |
|---|---|
| **Base URL (dev)** | `http://localhost:8080` |
| **Prod** | `https://api.transferpulse.app` |
| **Uç** | `POST /api/waitlist` |
| **Auth** | **Yok** (public) |
| **Content-Type** | `application/json` |
| **Rate limit** | **5 istek/dk/IP** (bu uca özel sıkı policy, + global 300/dk/IP) |
| **Bot savunması** | **Honeypot** alanı aktif (bkz. §4) |

---

## 2. E-posta Kaydet

### `POST /api/waitlist`  *(public)*

İstek gövdesi:

```jsonc
{
  "email": "meraklı@kullanici.com", // zorunlu, geçerli e-posta, ≤ 255
  "source": "landing"               // opsiyonel, ≤ 60 (ör. "landing", "footer", "hero")
}
```

- `email` sunucuda **küçük harfe çevrilir + trim** edilir; UI'da ekstra normalize gerekmez.
- `source` analitik için serbest bir etiket — hangi bölümün dönüştürdüğünü görmek için yolla.

Yanıt **`200 OK`** (aksiyon zarfı — `{ data }` ile sarılmaz):

```json
{ "success": true, "message": "Kayıt alındı" }
```

> **Idempotency:** Daha önce kayıtlı bir e-posta tekrar gönderilirse yine `200`
> döner; yeni kayıt **oluşmaz**, sayaç şişmez. Yani "zaten kayıtlısınız" gibi özel
> bir durum yönetmene gerek yok — her başarılı çağrıyı "teşekkürler" olarak göster.

---

## 3. Hata Yönetimi

Global hata zarfı:

```jsonc
{
  "success": false,
  "message": "Doğrulama hatası",
  "errors": [ /* alan bazlı detay */ ],
  "statusCode": 400,
  "path": "/api/waitlist",
  "timestamp": "..."
}
```

| Durum | `statusCode` | UI davranışı |
|---|---|---|
| Geçersiz e-posta formatı / boş | `400` | "Geçerli bir e-posta gir" |
| Çok fazla istek (flood) | `429` | "Biraz sonra tekrar dene" |
| Ağ / sunucu | `5xx` | "Bir şeyler ters gitti, tekrar dene" |

### Örnek (fetch)

```ts
async function joinWaitlist(email: string) {
  const res = await fetch(`${API_BASE}/api/waitlist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, source: 'landing' }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.message ?? 'Kayıt başarısız');
  }
  return res.json(); // { success: true, message: "Kayıt alındı" }
}
```

---

## 4. Auth gerekli mi? — Öneri (önemli)

**Kısa cevap: Hayır, klasik kullanıcı auth'una (JWT/Bearer) gerek yok.** Burada
kimliği doğrulanacak bir kullanıcı yok — anonim bir ziyaretçi e-posta bırakıyor.
Bu yüzden uç **public** bırakıldı.

### Peki "bir API key ile gelsin" fikri?

Mantıklı bir içgüdü ama tek başına **güvenlik sağlamaz** — sebebi şu:

- Landing page **tarayıcıda** çalışıyorsa, JS'e gömülü API key herkese **görünür**
  (kaynak kodu / network sekmesi). Kopyalayan biri yine spam atabilir. Yani
  client-side API key = güvenlik tiyatrosu.
- API key **gerçekten** işe yarar: landing'in **kendi sunucu/edge tarafı** (Next.js
  route handler, edge function, form backend) varsa ve key orada **gizli** tutulup
  istek oradan proxy'leniyorsa. O zaman `X-Api-Key` anlamlı bir paylaşılan sırdır.

### Önerilen kurulum

| Senaryo | Öneri |
|---|---|
| **Saf client-side landing** (statik, doğrudan tarayıcıdan POST) | API key **ekleme** (faydasız). Bunun yerine: **rate-limit** (mevcut) + **CORS origin allowlist** (sadece landing domaini) + opsiyonel **honeypot alanı** ve/veya **CAPTCHA** (proje env'inde `CAPTCHA_*` var). |
| **Server-side / edge'li landing** (SSR proxy) | Sunucuda gizli `X-Api-Key` tut, isteği oradan at. Backend'e küçük bir **API-key guard** ekleriz. Bu gerçek bir kapıdır. |

**Uygulanan kurulum:** Landing client-side kabul edildi → **public + sıkı rate-limit
(5/dk/IP) + honeypot**. Gömülü API key'den hem daha güvenli hem daha az kırılgan.

### 4.1 Honeypot — frontend'in YAPMASI gereken (önemli)

Backend, istek gövdesinde **`website`** adında gizli bir alan bekler:

- **Gerçek kullanıcı bu alanı görmez ve boş bırakır.**
- **Bot** sayfadaki tüm input'ları doldurma eğilimindedir → `website` dolu gelir →
  backend kaydı **sessizce yok sayar** (yine `200 { success: true }` döner; bota
  başarısız olduğunu belli etmez).

Frontend tarafında alanı **kullanıcıdan gizle** (CSS ile; `type="hidden"` bazı botları
kandırmaz, görünmez ama erişilebilir input daha iyi):

```html
<!-- Ekranda görünmez ama DOM'da var; gerçek kullanıcı dokunmaz -->
<div style="position:absolute; left:-9999px" aria-hidden="true">
  <label>Web sitesi
    <input type="text" name="website" tabindex="-1" autocomplete="off" />
  </label>
</div>
```

```jsonc
// Gerçek kullanıcı isteği (website boş/yok) → kaydedilir
{ "email": "ali@x.com", "source": "landing" }

// Bot isteği (website dolu) → 200 döner ama KAYDEDİLMEZ
{ "email": "spam@x.com", "source": "landing", "website": "http://spam.ru" }
```

> `website` alanı bilerek **OpenAPI/Swagger'da görünmez** (botlara ipucu vermemek
> için). Sözleşmede yoktur; sadece bu rehberde belgelenir.

### 4.2 Sonraki adım (gerekirse)

Bot trafiği honeypot + rate-limit'e rağmen sorun olursa eklenebilir (şu an YOK):
**CAPTCHA** (`CAPTCHA_SECRET` env'de hazır), landing domaini için sıkı **CORS**
whitelist, ya da landing'in **server/edge** tarafı varsa `X-Api-Key` guard'ı.

---

## 5. Unsubscribe (bilgi)

Toplanan e-postalara giden duyuru maillerinde RFC 8058 **List-Unsubscribe** başlığı
ve abonelikten çıkma linki bulunur. Kullanıcı çıkarsa abone `unsubscribed` olur ve
bir daha lansman/pazarlama maili **almaz**. Landing tarafında ek bir iş gerekmez —
sadece bilgi amaçlı.
