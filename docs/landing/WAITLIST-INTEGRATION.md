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
| **Rate limit** | write policy: 120 istek/dk/IP (+ global 300/dk/IP) |

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

**Bizim önerimiz:** Landing büyük ihtimalle client-side olduğundan, **public + rate-limit
+ CORS allowlist** ile başla; bot trafiği sorun olursa **CAPTCHA** ekle. Bu, gömülü
API key'den hem daha güvenli hem daha az kırılgan.

> **Yapılabilecek (opsiyonel) sertleştirmeler — şu an kodda YOK, isten eklenir:**
> 1. `X-Api-Key` guard'ı (yalnızca server-side caller anlamlı).
> 2. Gizli **honeypot** alanı (bot doldurursa sessizce reddet).
> 3. CAPTCHA token doğrulaması (`CAPTCHA_SECRET`).
> 4. Landing domaini için sıkı **CORS** whitelist.
>
> Hangisini istersen söyle, ucu ona göre genişletelim. (Mevcut hâl: public + write
> rate-limit yeterli koruma sağlıyor.)

---

## 5. Unsubscribe (bilgi)

Toplanan e-postalara giden duyuru maillerinde RFC 8058 **List-Unsubscribe** başlığı
ve abonelikten çıkma linki bulunur. Kullanıcı çıkarsa abone `unsubscribed` olur ve
bir daha lansman/pazarlama maili **almaz**. Landing tarafında ek bir iş gerekmez —
sadece bilgi amaçlı.
