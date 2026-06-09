import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';

/**
 * Cache-aside + tag tabanlı invalidation. Sık okunan public list/search
 * sonuçları Redis'te tutulur. Tüm operasyonlar fail-open: Redis hatasında
 * istek düşmez, producer (DB) sonucu döner ve hata yalnızca warn'lanır.
 *
 * Tag mekanizması: her cache key, ilgili tag set'lerine (örn. 'cache:tag:transfers')
 * üye yapılır. Bir yazma olduğunda tek tek key bilmek yerine tag invalidate edilir
 * → o tag'e bağlı tüm key'ler tek seferde silinir (prod'da KEYS/SCAN yerine O(1)).
 *
 * Not: RedisService keyPrefix 'tpulse:' uygular; aşağıdaki tüm key'ler otomatik
 * prefixlenir. Tag set member'ları (logical key string) prefixsiz saklanır ve
 * DEL'de tekrar key olarak verildiğinde aynı prefix uygulanır → tutarlı.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private static readonly TAG_PREFIX = 'cache:tag:';
  /** Tag set'leri en uzun cache TTL'inden biraz fazla yaşar (orphan member temizliği). */
  private static readonly TAG_TTL_BUFFER_SECONDS = 60;

  private hits = 0;
  private misses = 0;

  constructor(private readonly redis: RedisService) {}

  /**
   * Cache-aside okuma. Hit varsa parse edip döner; miss'te producer çalışır,
   * sonuç cache'lenir ve verilen tag'lere bağlanır.
   */
  async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    producer: () => Promise<T>,
    tags: string[] = [],
  ): Promise<T> {
    try {
      const raw = await this.redis.client.get(key);
      if (raw !== null) {
        this.hits += 1;
        this.logger.debug(`cache HIT ${key} (h=${this.hits} m=${this.misses})`);
        return JSON.parse(raw) as T;
      }
    } catch (err) {
      this.logger.warn(`cache okuma hatası (${key}): ${String(err)}`);
    }

    this.misses += 1;
    this.logger.debug(`cache MISS ${key} (h=${this.hits} m=${this.misses})`);
    const value = await producer();
    await this.store(key, value, ttlSeconds, tags);
    return value;
  }

  private async store<T>(
    key: string,
    value: T,
    ttlSeconds: number,
    tags: string[],
  ): Promise<void> {
    try {
      const pipeline = this.redis.client.pipeline();
      pipeline.set(key, JSON.stringify(value), 'EX', ttlSeconds);
      const tagTtl = ttlSeconds + CacheService.TAG_TTL_BUFFER_SECONDS;
      for (const tag of tags) {
        const tagKey = CacheService.TAG_PREFIX + tag;
        pipeline.sadd(tagKey, key);
        pipeline.expire(tagKey, tagTtl);
      }
      await pipeline.exec();
    } catch (err) {
      this.logger.warn(`cache yazma hatası (${key}): ${String(err)}`);
    }
  }

  /** Verilen tag'lere bağlı tüm key'leri ve tag set'lerini siler. */
  async invalidateTags(...tags: string[]): Promise<void> {
    for (const tag of tags) {
      const tagKey = CacheService.TAG_PREFIX + tag;
      try {
        const members = await this.redis.client.smembers(tagKey);
        const pipeline = this.redis.client.pipeline();
        if (members.length > 0) {
          pipeline.del(...members);
        }
        pipeline.del(tagKey);
        await pipeline.exec();
        if (members.length > 0) {
          this.logger.debug(
            `cache invalidate tag=${tag} keys=${members.length}`,
          );
        }
      } catch (err) {
        this.logger.warn(
          `cache invalidate hatası (tag=${tag}): ${String(err)}`,
        );
      }
    }
  }

  /** Tek bir key'i siler (nadir; çoğunlukla tag invalidation tercih edilir). */
  async invalidateKey(key: string): Promise<void> {
    try {
      await this.redis.client.del(key);
    } catch (err) {
      this.logger.warn(`cache key silme hatası (${key}): ${String(err)}`);
    }
  }

  /**
   * Namespace + parametre objesinden deterministik cache key üretir.
   * Anahtarlar sıralanır → aynı parametreler her zaman aynı key.
   */
  static buildKey(
    namespace: string,
    params: Record<string, unknown> = {},
  ): string {
    const serialized = CacheService.stableStringify(params);
    return serialized ? `q:${namespace}:${serialized}` : `q:${namespace}`;
  }

  private static stableStringify(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value !== 'object') {
      return String(value);
    }
    if (Array.isArray(value)) {
      return `[${value.map((v) => CacheService.stableStringify(v)).join(',')}]`;
    }
    const obj = value as Record<string, unknown>;
    return Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort()
      .map((k) => `${k}=${CacheService.stableStringify(obj[k])}`)
      .join('&');
  }
}
