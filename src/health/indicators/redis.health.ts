import { Injectable } from '@nestjs/common';
import {
  HealthIndicatorResult,
  HealthIndicatorService,
} from '@nestjs/terminus';
import { RedisService } from '../../common/redis/redis.service';

@Injectable()
export class RedisHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly redis: RedisService,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    try {
      const ok = await this.redis.ping();
      return ok ? indicator.up() : indicator.down({ message: 'no PONG' });
    } catch (error) {
      return indicator.down({
        message: error instanceof Error ? error.message : 'unreachable',
      });
    }
  }
}
