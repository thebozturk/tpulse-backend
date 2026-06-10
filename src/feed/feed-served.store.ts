import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../common/redis/redis.service';
import { FeedConfig } from './feed.config';

/**
 * Kullanıcıya sunulan post id'lerini Redis set'inde tutar (TTL'li sliding
 * window). Sonraki sayfalarda tekrar gösterimi önler. Tüm operasyonlar
 * fail-open: Redis hatası feed'i düşürmez (yalnızca warn).
 */
@Injectable()
export class FeedServedStore {
  private readonly logger = new Logger(FeedServedStore.name);

  constructor(
    private readonly redis: RedisService,
    private readonly config: FeedConfig,
  ) {}

  private key(userId: string): string {
    return `feed:served:${userId}`;
  }

  async getServed(userId: string): Promise<Set<string>> {
    try {
      const ids = await this.redis.client.smembers(this.key(userId));
      return new Set(ids);
    } catch (err) {
      this.logger.warn(`served okuma hatası (user=${userId}): ${String(err)}`);
      return new Set();
    }
  }

  async markServed(userId: string, postIds: string[]): Promise<void> {
    if (postIds.length === 0) {
      return;
    }
    try {
      const k = this.key(userId);
      const pipeline = this.redis.client.pipeline();
      pipeline.sadd(k, ...postIds);
      pipeline.expire(k, this.config.servedTtlSeconds);
      await pipeline.exec();
    } catch (err) {
      this.logger.warn(`served yazma hatası (user=${userId}): ${String(err)}`);
    }
  }
}
