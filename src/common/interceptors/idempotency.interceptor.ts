import {
  BadRequestException,
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { RedisService } from '../redis/redis.service';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const HEADER = 'idempotency-key';
const MAX_KEY_LENGTH = 255;
const DEFAULT_TTL_SECONDS = 600;

/**
 * docs/04 §2 IdempotencyMiddleware karşılığı.
 * Mutating uçlarda `Idempotency-Key` header'ı varsa Redis SET NX ile tekrar
 * koruması (key `idem:{userId}:{method}:{path}:{key}`, TTL ~10dk).
 * - Header yoksa / GET vb. ise → no-op.
 * - Aynı key TTL içinde tekrar gelirse → 409 (tekrar işlenmez, .NET parite).
 * - Redis hatası → fail-open (logla, isteği geçir).
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);
  private readonly ttlSeconds: number;

  constructor(
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    this.ttlSeconds =
      config.get<number>('idempotency.ttlSeconds') ?? DEFAULT_TTL_SECONDS;
  }

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: { sub?: string } }>();

    if (!MUTATING.has(request.method)) {
      return next.handle();
    }

    const raw = request.headers[HEADER];
    const key = (Array.isArray(raw) ? raw[0] : raw)?.trim();
    if (!key) {
      return next.handle();
    }
    if (key.length > MAX_KEY_LENGTH) {
      throw new BadRequestException('Idempotency-Key çok uzun');
    }

    const userId = request.user?.sub ?? 'anon';
    const redisKey = `idem:${userId}:${request.method}:${request.path}:${key}`;

    let acquired: string | null;
    try {
      acquired = await this.redis.client.set(
        redisKey,
        '1',
        'EX',
        this.ttlSeconds,
        'NX',
      );
    } catch (e) {
      this.logger.warn(
        `Idempotency Redis hatası, fail-open: ${e instanceof Error ? e.message : 'unknown'}`,
      );
      return next.handle();
    }

    if (acquired !== 'OK') {
      throw new ConflictException('Bu istek zaten alındı (idempotency)');
    }
    return next.handle();
  }
}
