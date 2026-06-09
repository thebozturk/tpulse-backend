/**
 * Cache tag'leri ve TTL'leri (dengeli tazelik profili).
 * Yazma noktaları bu tag'leri invalidate eder; okuma noktaları bu tag'lerle
 * cache'ler. Magic string yerine tek kaynak.
 */
export const CacheTag = {
  Transfers: 'transfers',
  Players: 'players',
  Teams: 'teams',
  Leagues: 'leagues',
} as const;

export type CacheTag = (typeof CacheTag)[keyof typeof CacheTag];

/** TTL saniye — listeler invalidation-driven (300s tavan), search kısa (60s). */
export const CacheTtl = {
  List: 300,
  Search: 60,
} as const;
