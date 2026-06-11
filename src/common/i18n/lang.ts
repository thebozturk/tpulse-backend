/**
 * Desteklenen gösterim dilleri. Varsayılan `tr` (uygulama Türkçe odaklı).
 * Veri katmanında her isim için İngilizce (`name`/`firstName`/...) kanonik kolon,
 * Türkçe karşılığı (`nameTr`/...) opsiyonel kolon olarak tutulur.
 */
export type Lang = 'tr' | 'en';

export const DEFAULT_LANG: Lang = 'tr';

/**
 * `Accept-Language` header'ından gösterim dilini çözer.
 * İlk dil etiketi `en`* ise İngilizce, aksi halde (boş/tr/diğer) varsayılan Türkçe.
 */
export function resolveLang(acceptLanguage?: string | null): Lang {
  const first = acceptLanguage?.split(',')[0]?.trim().toLowerCase() ?? '';
  if (first.startsWith('en')) {
    return 'en';
  }
  return DEFAULT_LANG;
}

/**
 * Dile göre isim seçer: `tr` ise Türkçe değer (yoksa İngilizce'ye düşer), aksi halde İngilizce.
 */
export function pickName(lang: Lang, en: string, tr?: string | null): string {
  return lang === 'tr' ? (tr ?? en) : en;
}
