import { Injectable, Logger } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

/**
 * Kullanıcı durumunun (UserStatus) Redis read-through cache'i.
 *
 * JwtAuthGuard her korumalı istekte buradan okur: banlı/suspend/inactive kullanıcı
 * access token'ı henüz dolmamış olsa bile anında engellenir; DB her istekte dövülmez
 * (cache miss'te 1 kez okunur, kısa TTL ile tutulur).
 *
 * BO-2 (kullanıcı yönetimi) durum değiştirdiğinde setStatus/invalidate ile cache'i tazeler.
 */
@Injectable()
export class UserStatusCache {
  private readonly logger = new Logger(UserStatusCache.name);
  private static readonly TTL_SECONDS = 60;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private key(userId: string): string {
    return `auth:status:${userId}`;
  }

  /**
   * userId'nin durumunu döner. Cache miss → DB'den okur ve cache'ler.
   * Kullanıcı yoksa null. Redis erişilemezse DB'ye düşer (durum yine doğrulanır).
   */
  async getStatus(userId: string): Promise<UserStatus | null> {
    try {
      const cached = await this.redis.client.get(this.key(userId));
      if (cached) {
        return cached as UserStatus;
      }
    } catch (err) {
      this.logger.warn(`Redis okuma hatası, DB'ye düşülüyor: ${String(err)}`);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { status: true },
    });
    if (!user) {
      return null;
    }

    await this.writeCache(userId, user.status);
    return user.status;
  }

  /** Durum değişiminde cache'i tazeler (BO-2). */
  async setStatus(userId: string, status: UserStatus): Promise<void> {
    await this.writeCache(userId, status);
  }

  /** Cache kaydını siler — bir sonraki okuma DB'den tazelenir (BO-2). */
  async invalidate(userId: string): Promise<void> {
    try {
      await this.redis.client.del(this.key(userId));
    } catch (err) {
      this.logger.warn(`Redis del hatası: ${String(err)}`);
    }
  }

  private async writeCache(userId: string, status: UserStatus): Promise<void> {
    try {
      await this.redis.client.set(
        this.key(userId),
        status,
        'EX',
        UserStatusCache.TTL_SECONDS,
      );
    } catch (err) {
      this.logger.warn(`Redis yazma hatası: ${String(err)}`);
    }
  }
}
