# Lansman E-postası — AI Tasarım Prompt'u

Lansman duyuru template'ini (`src/email/templates/LaunchEmail.tsx`) AI ile yeniden
tasarlamak için. Mevcut hali "düz" placeholder — bunu AI'a verip cilalı bir tasarım
ürettir, çıkan JSX'i `LaunchEmail.tsx` içine koy.

## Bağlam (AI'a ver)

- **Ürün:** TransferPulse — futbol transfer & söylenti takip uygulaması.
- **Stack:** React Email (`@react-email/components`) + Tailwind. Tema **koyu** (dark).
- **Ortak sarmalayıcı:** `EmailLayout` (Html/Head/Font/Tailwind/Preview/Body/Header/Footer
  hepsini sağlar). Sadece **içeriği** üret; layout'a dokunma.
- **Hazır component'ler (bunları kullan, yeni stil icat etme):**
  - `<Title>` , `<Body as Paragraph>` — `./components/Typo`
  - `<Button href block>` — `./components/Button`
  - `<Badge variant="lime">` — `./components/Badge`
  - `colors`, `fontStacks` — `./components/theme`
  - `<Section>`, `<Text>` — `@react-email/components`
- **Renk dili:** koyu arka plan, vurgu rengi **lime** (`colors` içinden, hardcode etme).
- **Marka alanları prop ile gelir:** `ctaUrl`, `assetBaseUrl`, `unsubscribeUrl`. Bunları
  değiştirme — yalnızca tasarımı zenginleştir.
- **Kopya tek kaynaktan:** Metinler `src/email/launch.content.ts` içindeki
  `LAUNCH_EMAIL_CONTENT`'ten gelir (`subject`, `preview`, `badgeLabel`, `heading`,
  `paragraphs`, `ctaLabel`, `ctaPath`). Tasarımda bu alanları kullan; metni JSX'e
  gömme. Yeni metin alanı gerekiyorsa önce `launch.content.ts`'e ekle.

## İstenen

`LaunchEmail.tsx`'in `default export` fonksiyonunun **return JSX'ini** yeniden tasarla.
Imza ve export'lar (`LaunchEmailProps`, `export const subject`) **aynı kalsın**.

Tasarım hedefleri:
- Lansman/kutlama havası — net hero başlık, kısa heyecan verici gövde, güçlü tek CTA.
- E-posta uyumlu: tablo-temelli güvenli layout, inline-safe stiller, max 600px (layout hallediyor).
- Dark mode + lime vurgu; Gmail/Outlook/Apple Mail'de bozulmadan render olmalı.
- Görsel kullanılacaksa `assetBaseUrl` ile mutlak URL (`${assetBaseUrl}/...`); harici host yok.
- Erişilebilir: anlamlı alt metin, yeterli kontrast.

## Kısıtlar

- `dangerouslySetInnerHTML` kullanma.
- `EmailLayout`, `Header`, `Footer`'ı yeniden yazma — sadece children üret.
- Yeni npm paketi ekleme; sadece `@react-email/components` + mevcut component'ler.
- `subject`/`preview` mantığını değiştirme.

## Çıktı formatı

Tam `LaunchEmail.tsx` dosyası (import'lar dahil), kopyalayıp yapıştırılabilir halde.
