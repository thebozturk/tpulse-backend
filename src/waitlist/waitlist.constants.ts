export const LAUNCH_QUEUE = 'waitlist-launch';

/** Tek seferde işlenen abone sayısı (senkron döngü yerine cursor-batch). */
export const LAUNCH_BATCH_SIZE = 100;

/**
 * Ardışık e-posta gönderimleri arası bekleme (ms). Resend rate-limit'ine
 * (varsayılan ~2 istek/sn) saygı için; worker concurrency = 1 ile birlikte
 * sağlayıcı limitini aşmadan sıralı gönderim sağlar.
 */
export const SEND_DELAY_MS = 600;

export interface LaunchJobData {
  campaignId: string;
}
