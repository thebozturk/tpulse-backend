# TransferPulse — Mobil E-posta & Deep Link Entegrasyonu

Bu belge, backend'de kurulan e-posta sisteminin (doğrulama, şifre sıfırlama,
abonelikten çıkma, bildirim tercihleri) **mobil app entegrasyonunu** anlatır.
Backend kodu okumadan implement edebilmen için tüm endpoint'ler, link formatları
ve akışlar burada.

> **TL;DR:** Backend e-postaları üretir ve gönderir. Mobil app'in işi:
> (1) `https://transferpulse.app/...` deep link'lerini **Universal/App Link** olarak
> yakalamak, (2) query'den `token`/`email`'i okuyup ilgili **API ucunu çağırmak**,
> (3) sonucu UI'da göstermek. App kurulu değilse aynı `https` link **web fallback**
> sayfasını açar (web ekibi sağlar) — yani link her durumda çalışır.

---

## 1. Mimari

```
 E-posta (Resend)
   │  https://transferpulse.app/verify-email?email=…&token=…
   ▼
 Kullanıcı linke tıklar
   ├─ App KURULU  → iOS Universal Link / Android App Link → APP açılır
   │                 app token'ı parse eder → POST /api/auth/verify-email
   └─ App YOK     → aynı https URL → WEB FALLBACK sayfası (web ekibi)
                     web de aynı API ucunu çağırır
```

Backend tarafı hazır; app'in **kod değişikliği beklemeden** bağlanabilmesi için
gereken her şey aşağıda.

---

## 2. Deep Link Kurulumu (transferpulse.app)

Üç path app tarafından yakalanmalı:

| Path | Amaç | Query parametreleri |
|------|------|---------------------|
| `/verify-email` | E-posta doğrulama | `email`, `token` |
| `/reset-password` | Şifre sıfırlama | `email`, `token` |
| `/abonelik/cik` | E-posta aboneliğinden çıkma | `token` |

### iOS — Universal Links
1. **Associated Domains** entitlement ekle: `applinks:transferpulse.app`
2. Web ekibi `https://transferpulse.app/.well-known/apple-app-site-association`
   (AASA, `Content-Type: application/json`, uzantısız) dosyasını yayınlar; app'in
   `appID`'si ve yukarıdaki path'ler `components` altında listelenir.
3. App `scene(_:continue:)` / `application(_:continue:)` ile gelen `NSUserActivity`
   `webpageURL`'ini parse eder.

### Android — App Links
1. `AndroidManifest.xml`'de ilgili Activity'ye `intent-filter` + `android:autoVerify="true"`:
   ```xml
   <intent-filter android:autoVerify="true">
     <action android:name="android.intent.action.VIEW" />
     <category android:name="android.intent.category.DEFAULT" />
     <category android:name="android.intent.category.BROWSABLE" />
     <data android:scheme="https" android:host="transferpulse.app"
           android:pathPrefix="/verify-email" />
     <!-- /reset-password ve /abonelik/cik için de ekle -->
   </intent-filter>
   ```
2. Web ekibi `https://transferpulse.app/.well-known/assetlinks.json` (app package adı +
   SHA-256 imza parmak izi) yayınlar.
3. App `Intent.data` (deeplink URI) üzerinden query'leri okur.

> **Not:** Custom scheme (`transferpulse://`) KULLANILMAZ — e-posta istemcileri
> custom scheme'i bloklar. Linkler bilerek `https`.

### Token'ı parse etme
- `email` ve `token` standart URL query parametreleridir; URL parser'ın bunları
  otomatik decode eder (backend `encodeURIComponent` ile gönderir — sen decode'lanmış
  halini alırsın).
- `/abonelik/cik` tokenı **base64url** formatındadır (`.` içerebilir) — query değeri
  olarak ham alıp aynen API'ye gönder, ekstra decode/encode YAPMA.

---

## 3. API Temelleri

- **Base URL:** `https://api.transferpulse.app` _(backend ekibiyle doğrula — route'lar
  `api/...` prefix'iyle başlar; API ayrı host'taysa base buna göre)._
- **Auth:** Bu belgedeki uçların tümü **public** (token gerektirmez), sadece
  bildirim tercihleri `Authorization: Bearer <accessToken>` ister.
- **Content-Type:** `application/json`
- **Rate limit:** auth uçları 30 istek/dk/IP, diğerleri 120/dk. 429 → kullanıcıya
  "biraz sonra tekrar dene".

### Başarılı yanıt — aksiyon uçları
```json
{ "success": true, "message": "E-posta doğrulandı" }
```
### Başarılı yanıt — login/register
```json
{
  "accessToken": "…",
  "refreshToken": "…",
  "expiresAt": "2026-06-09T19:00:00.000Z",
  "user": {
    "id": "…", "username": "…", "email": "…", "nickname": "…",
    "isMailConfirm": false,        // ← e-posta doğrulandı mı
    "status": "Active",
    "favouriteTeam": "…", "reputationScore": 0, "role": "User",
    "createdAt": "…"
  }
}
```
### Hata yanıtı (global filter)
```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Geçersiz veya süresi dolmuş doğrulama bağlantısı",
  "errors": [],
  "requestId": "…",
  "timestamp": "…",
  "path": "/api/auth/verify-email"
}
```

---

## 4. Akışlar

### 4.1 E-posta Doğrulama

**Tetikleme:** Kullanıcı kayıt olunca (`POST /api/auth/register`) backend doğrulama
e-postası gönderir ve dönen `user.isMailConfirm` **false** olur. App, `false` ise
"E-postanı doğrula" banner'ı / ekranı göstermeli (kayıt yine de auto-login'dir —
token döner; doğrulama login'i engellemez, sadece bir flag'tir).

**Deep link:** `https://transferpulse.app/verify-email?email=<email>&token=<token>`

**App ne yapar:**
```
POST /api/auth/verify-email
{ "email": "<email>", "token": "<token>" }
→ 200 { "success": true, "message": "E-posta doğrulandı" }
→ 400 token geçersiz/expired
```
- Başarıda: kullanıcı profilini tazele (`isMailConfirm` artık true) ve banner'ı kaldır.
- **Idempotent:** zaten doğrulanmışsa da 200 döner (tekrar tıklamada hata gösterme).
- Token ömrü varsayılan **24 saat** (`EMAIL_VERIFY_TOKEN_MINUTES`).

**Yeniden gönderme** (banner'daki "Tekrar gönder" butonu):
```
POST /api/auth/resend-verification
{ "email": "<email>" }
→ 200 { "success": true, "message": "E-posta kayıtlı ve doğrulanmamışsa bağlantı gönderildi" }
```
- **Enumeration-safe:** kullanıcı yoksa/zaten doğrulanmışsa da aynı 200 döner —
  yanıttan kullanıcı varlığı çıkarılamaz; mesajı olduğu gibi göster.

### 4.2 Şifre Sıfırlama

**Adım 1 — istek** (app içi "Şifremi unuttum" ekranı):
```
POST /api/auth/forgot-password
{ "email": "<email>" }
→ 200 { "success": true, "message": "E-posta kayıtlıysa sıfırlama bağlantısı gönderildi" }
```
Enumeration-safe; her zaman 200.

**Adım 2 — deep link:** `https://transferpulse.app/reset-password?email=<email>&token=<token>`
App linki yakalar → "Yeni şifre" ekranını açar (email + token'ı linkten taşı).

**Adım 3 — yeni şifre:**
```
POST /api/auth/reset-password
{ "email": "<email>", "token": "<token>", "newPassword": "<yeni>" }
→ 200 { "success": true, "message": "Parola güncellendi" }
→ 400 geçersiz/expired token veya parola kuralları
```
**Parola kuralları (client'ta da doğrula):** 8–72 karakter, en az 1 büyük harf,
1 küçük harf, 1 rakam.
- Başarıda tüm refresh token'lar iptal edilir → kullanıcıyı yeni şifreyle login'e yönlendir.
- Token ömrü varsayılan **60 dk** (`PASSWORD_RESET_TOKEN_MINUTES`).

### 4.3 Abonelikten Çıkma (Unsubscribe)

Her digest/pazarlama e-postasının footer'ında imzalı link bulunur:
`https://transferpulse.app/abonelik/cik?token=<token>`

**App ne yapar:** Onay ekranı göster ("Digest e-postalarından çıkmak istiyor musun?"),
onayda:
```
POST /api/email/unsubscribe
{ "token": "<token>" }
→ 200 { "success": true, "message": "E-posta aboneliğinden çıkıldı" }
→ 400 token geçersiz
```
- Token tek başına yeterli (email içinde imzalı). **Decode etme**, ham gönder.
- Sadece digest/pazarlama e-postalarını kapatır; doğrulama/şifre/güvenlik gibi
  **transactional** e-postalar etkilenmez.
- Idempotent (zaten çıkmışsa da 200).

---

## 5. Bildirim & E-posta Tercihleri (in-app, opsiyonel ama önerilir)

Kullanıcı uygulama içinden de tercih yönetebilir. **Auth gerektirir**
(`Authorization: Bearer <accessToken>`).

```
GET /api/me/notification-preferences
→ { "items": [ { "eventType": 1, "enabled": true }, … ] }

PUT /api/me/notification-preferences
{ "preferences": [ { "eventType": 1, "enabled": false }, … ] }
```
`eventType`: `1=Söylenti(Rumour)`, `2=Transfer`, `3=Duyuru(Announcement)`.
- Bu tercihler hem in-app bildirimleri hem **TransferAlert digest e-postasının**
  içeriğini etkiler (kapatılan tip digest'te listelenmez).
- "Tüm e-postaları kapat" davranışı için ayrıca §4.3 unsubscribe akışı kullanılır
  (ikisi farklı: biri tip-bazlı tercih, diğeri genel e-posta opt-out'u).

---

## 6. Test (RESEND_API_KEY olmadan)

Dev ortamında `RESEND_API_KEY` boşsa backend e-posta **göndermez**, bunun yerine
linki **log'a** yazar:
```
[EMAIL DISABLED] "E-postanı doğrula — TransferPulse" → user@x.com · https://…/verify-email?email=…&token=…
```
Bu linki kopyalayıp deep link testinde kullan:
- **iOS:** `xcrun simctl openurl booted "https://transferpulse.app/verify-email?email=…&token=…"`
- **Android:** `adb shell am start -a android.intent.action.VIEW -d "https://transferpulse.app/verify-email?email=…&token=…"`

---

## 7. Mobil Ekip Checklist

- [ ] iOS Associated Domains: `applinks:transferpulse.app` + AASA path'leri doğrulandı
- [ ] Android App Links: intent-filter (autoVerify) + assetlinks.json doğrulandı
- [ ] Deep link router: `/verify-email`, `/reset-password`, `/abonelik/cik` → ekranlar
- [ ] Query parse: `email`, `token` (unsubscribe'da yalnız `token`, ham)
- [ ] Register sonrası `user.isMailConfirm == false` → doğrulama banner'ı
- [ ] `verify-email` çağrısı + idempotent başarı + "tekrar gönder"
- [ ] `forgot-password` → `reset-password` ekranı + parola kuralları (8–72, A-a-0)
- [ ] `unsubscribe` onay ekranı
- [ ] (Ops.) Bildirim tercihleri ekranı (`/api/me/notification-preferences`)
- [ ] Hata yönetimi: 400 (token geçersiz/expired), 429 (rate limit), enumeration-safe mesajlar
- [ ] API base URL backend ekibiyle teyit edildi

---

## 8. Endpoint Hızlı Referans

| Method | Path | Auth | Body | Not |
|--------|------|------|------|-----|
| POST | `/api/auth/register` | – | kayıt alanları | dönüş `isMailConfirm:false` + doğrulama maili |
| POST | `/api/auth/verify-email` | – | `{ email, token }` | idempotent |
| POST | `/api/auth/resend-verification` | – | `{ email }` | enumeration-safe |
| POST | `/api/auth/forgot-password` | – | `{ email }` | enumeration-safe |
| POST | `/api/auth/reset-password` | – | `{ email, token, newPassword }` | parola kuralları |
| POST | `/api/email/unsubscribe` | – | `{ token }` | ham token |
| GET | `/api/me/notification-preferences` | Bearer | – | tip-bazlı tercihler |
| PUT | `/api/me/notification-preferences` | Bearer | `{ preferences:[…] }` | |

_Son güncelleme: bu belge `feat/email-system` branch'iyle birlikte gelir._
