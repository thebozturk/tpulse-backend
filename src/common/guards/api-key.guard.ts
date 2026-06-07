import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { Request } from 'express';

const HEADER = 'x-api-key';

/**
 * Servis-to-servis (bot) ingestion guard'ı.
 * - Gelen `X-Api-Key`'in SHA-256'sı, config'teki `bot.apiKeyHash` ile constant-time
 *   karşılaştırılır (timing attack'a kapalı).
 * - Hash yapılandırılmamışsa veya eşleşmezse 401 (fail-closed).
 * Global JwtAuthGuard'dan @Public() ile ayrılmış uçlarda kullanılır.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expectedHash = this.config.get<string>('bot.apiKeyHash');
    if (!expectedHash) {
      this.logger.warn('BOT_API_KEY_HASH tanımlı değil — ingestion kapalı');
      throw new UnauthorizedException('API key doğrulaması yapılandırılmamış');
    }

    const request = context.switchToHttp().getRequest<Request>();
    const raw = request.headers[HEADER];
    const provided = (Array.isArray(raw) ? raw[0] : raw)?.trim();
    if (!provided) {
      throw new UnauthorizedException('API key eksik');
    }

    const providedHash = crypto
      .createHash('sha256')
      .update(provided)
      .digest('hex');

    if (!this.safeEqual(providedHash, expectedHash)) {
      throw new UnauthorizedException('Geçersiz API key');
    }
    return true;
  }

  /** Uzunluk farkında bile sabit zaman: önce buffer'a çevir, eşit uzunlukta değilse false. */
  private safeEqual(a: string, b: string): boolean {
    const ab = Buffer.from(a, 'utf8');
    const bb = Buffer.from(b, 'utf8');
    if (ab.length !== bb.length) {
      return false;
    }
    return crypto.timingSafeEqual(ab, bb);
  }
}
