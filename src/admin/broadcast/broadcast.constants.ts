export const BROADCAST_QUEUE = 'broadcast';

/** Tek seferde işlenen kullanıcı sayısı (senkron döngü yerine batch). */
export const BROADCAST_BATCH_SIZE = 500;

export interface BroadcastJobData {
  broadcastId: string;
}
