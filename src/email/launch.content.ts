/**
 * Lansman duyuru e-postasının SABİT içeriği. Panelden gelmez — "Lansmanı Başlat"
 * butonu yalnızca bu template'i tetikler. Kopyayı buradan düzenle; tasarım/HTML
 * `templates/LaunchEmail.tsx` içinde, copy'yi buradan besler (tek kaynak).
 *
 * AI ile yeniden tasarlarken: bu metinleri ve LaunchEmail.tsx'i güncelle.
 */
export const LAUNCH_EMAIL_CONTENT = {
  /** Gelen kutusu konu satırı. */
  subject: 'TransferPulse yayında! 🚀',
  /** Gelen kutusu önizleme satırı. */
  preview: 'Beklediğin an geldi — TransferPulse artık canlıda.',
  /** Üstteki rozet etiketi. */
  badgeLabel: 'Lansman',
  /** Ana başlık. */
  heading: 'Beklediğin an geldi 🎉',
  /** Gövde paragrafları (her biri ayrı <p>). */
  paragraphs: [
    'TransferPulse artık canlıda. Favori takımlarını ve oyuncularını takip et, transfer söylentilerini ilk sen öğren.',
    'Bizi beklediğin için teşekkürler — şimdi keşfetme zamanı.',
  ],
  /** CTA buton metni. */
  ctaLabel: 'Hemen keşfet',
  /** CTA yolu; tam URL servis tarafından `webUrl + ctaPath` ile kurulur. */
  ctaPath: '/kesfet',
} as const;

/** Kampanya geçmişi kaydı için düz metin gövde (DB'de saklanır). */
export const LAUNCH_HISTORY_BODY = LAUNCH_EMAIL_CONTENT.paragraphs.join('\n\n');
