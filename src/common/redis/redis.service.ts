import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * ioredis wrapper. Idempotency, cache-aside ve (ileride) BullMQ bu bağlantıyı kullanır.
 * Key prefix 'tpulse:' (docs/04 Redis:InstanceName ile uyumlu).
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  public readonly client: Redis;

  constructor(private readonly config: ConfigService) {
    this.client = new Redis(
      this.config.getOrThrow<string>('redis.connectionString'),
      {
        keyPrefix: 'tpulse:',
        maxRetriesPerRequest: null,
        lazyConnect: true,
      },
    );
  }

  async onModuleInit(): Promise<void> {
    await this.client.connect();
    this.logger.log('Redis bağlantısı kuruldu');
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
    this.logger.log('Redis bağlantısı kapatıldı');
  }

  async ping(): Promise<boolean> {
    const pong = await this.client.ping();
    return pong === 'PONG';
  }
}
