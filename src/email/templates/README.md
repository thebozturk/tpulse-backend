# TransferPulse — E-posta Şablonları

React Email + TypeScript (strict) ile üretilmiş 12 transactional template. Tüm metinler Türkçe, dark email-client uyumlu, 600px tek kolon.

## Bağımlılıklar

```bash
npm i @react-email/components @react-email/render react react-dom
npm i -D react-email   # dev server (npx react-email dev)
```

## Dosya ağacı

```
src/email/templates/
├─ components/        # paylaşılan: theme, EmailLayout, Header, Footer, Button, Card, Badge, InfoRow, Typo
├─ *.tsx              # 12 template (her biri: default component + named `subject` + props interface)
├─ index.ts           # render helper'ları (renderXEmail)
└─ preview/           # react-email dev server için örnek prop'lu wrapper'lar
```

## EmailService'te kullanım

Entegrasyon tamam — `EmailService` her tip için typed metot sunar. `assetBaseUrl`
ve `unsubscribeUrl` servis tarafından merkezi doldurulur; çağıran sadece domain
alanlarını verir:

```ts
// Örn. kayıt sonrası:
await this.email.sendWelcome(user.email, {
  name: user.nickname,
  ctaUrl: `${webUrl}/kesfet`,
});

// Şifre sıfırlama (resetUrl + süre config'ten kurulur):
await this.email.sendPasswordReset(user.email, rawToken, user.nickname);
```

Gönderim **Resend** ile yapılır. `RESEND_API_KEY` ayarlı değilse e-posta
gönderilmez, konu+alıcı LOG'a yazılır — akış kesilmez. Render helper'ları
(`renderXEmail`) `index.ts`'ten ayrıca dışa aktarılır (test/preview için).

## Logo

Gmail SVG'yi bloklar → PNG kullanılır. Logolar `public/` altında, API statik
serve eder (`main.ts` `useStaticAssets` + `/public/` prefix). Header
`${assetBaseUrl}/dark-mode-horizontal.png` yükler; `assetBaseUrl` =
`EMAIL_ASSET_BASE_URL` (default `http://localhost:8080/public`). S3'e geçince
sadece bu env değişir, kod/template değişmez.

## Marka token'ları

Tek kaynak: `components/theme.ts`. Hem `<Tailwind config>` hem inline stiller buradan beslenir
(bazı client'lar Tailwind class'larını desteklemediği için fallback inline stiller var).

| token | değer |
|---|---|
| lime (vurgu/CTA) | `#C6F135` (üstüne `#0A0A0A` metin) |
| bg / surface / elevated / border | `#0A0A0A` / `#141414` / `#1C1C1C` / `#262626` |
| success / warning / danger | `#3DD68C` / `#F5A623` / `#F7554F` |

## Önizleme

- **Tüm setin görsel galerisi:** `preview-gallery.html` (tarayıcıda aç).
- **Canlı dev:** `npx react-email dev` → `preview/` altındaki örnek prop'lu render'lar.
