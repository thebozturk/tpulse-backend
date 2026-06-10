/**
 * E-posta metinlerinde geçerlilik süresini insan-dostu biçimde gösterir.
 * Dakika 60'ın katıysa saat olarak yazar (1440 → "24 saat", 60 → "1 saat").
 * Aksi halde saat + dakika ("90 → 1 saat 30 dakika") veya saf dakika döner.
 */
export function formatExpiry(minutes: number): string {
  if (minutes <= 0) return '0 dakika';
  if (minutes < 60) return `${minutes} dakika`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} saat` : `${hours} saat ${rest} dakika`;
}
