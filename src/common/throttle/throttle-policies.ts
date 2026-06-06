import { ThrottlerOptions } from '@nestjs/throttler';

/**
 * İsimlendirilmiş rate-limit policy'leri (docs/02 + docs/04).
 * - auth:      login/register gibi kimlik uçları (sıkı)
 * - write:     mutating controller'lar (POST/PUT/PATCH/DELETE)
 * - adminBulk: pahalı toplu admin işleri (broadcast vb.) — en sıkı
 * Global limit (300/dk/IP) ThrottlerModule.forRoot([GLOBAL_THROTTLE]) ile.
 *
 * Not: Multi-pod dağıtımda Redis storage gerekir; proje tek process olduğu
 * için in-memory throttler korunur.
 */
export const ThrottlePolicies = {
  auth: { default: { limit: 30, ttl: 60_000 } },
  write: { default: { limit: 120, ttl: 60_000 } },
  adminBulk: { default: { limit: 10, ttl: 60_000 } },
} as const;

export const GLOBAL_THROTTLE: ThrottlerOptions = { ttl: 60_000, limit: 300 };
