import { CacheService } from './cache.service';

/**
 * Test mock'u: getOrSet daima producer'ı çalıştırır (cache devre dışı),
 * invalidateTags/invalidateKey no-op. Servis testlerinde cache'i şeffaf kılar.
 */
export function passthroughCache(): CacheService {
  return {
    getOrSet: <T>(_key: string, _ttl: number, producer: () => Promise<T>) =>
      producer(),
    invalidateTags: jest.fn().mockResolvedValue(undefined),
    invalidateKey: jest.fn().mockResolvedValue(undefined),
  } as unknown as CacheService;
}
