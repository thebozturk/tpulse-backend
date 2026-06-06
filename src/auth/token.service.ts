import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';

export interface AccessToken {
  accessToken: string;
  expiresAt: Date;
}

export interface JwtPayload {
  sub: string;
  email: string;
  unique_name: string;
  nickname: string;
  role: string;
  jti: string;
}

/**
 * Access JWT üretimi + opaque refresh token rotation.
 * Refresh token DB'de SHA-256 hash'li saklanır (karar: Faz 2). Client ham token tutar.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  generateAccessToken(user: User): AccessToken {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      unique_name: user.username,
      nickname: user.nickname,
      role: user.role,
      jti: crypto.randomUUID(),
    };
    const accessToken = this.jwt.sign(payload);
    const decoded = this.jwt.decode(accessToken) as { exp: number };
    return { accessToken, expiresAt: new Date(decoded.exp * 1000) };
  }

  /** Yeni refresh token üretir, hash'ini DB'ye yazar, HAM token'ı döner. */
  async issueRefreshToken(userId: string): Promise<string> {
    const raw = crypto.randomBytes(64).toString('hex');
    const days = this.config.getOrThrow<number>('jwt.refreshExpiryDays');
    await this.prisma.refreshToken.create({
      data: {
        userId,
        token: this.hash(raw),
        expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
      },
    });
    return raw;
  }

  /** Rotation: eski token'ı doğrula+revoke, yenisini üret. Geçersizse 401. */
  async rotateRefreshToken(
    rawToken: string,
  ): Promise<{ rawToken: string; userId: string }> {
    const hash = this.hash(rawToken);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { token: hash },
    });
    if (
      !existing ||
      existing.revokedAt !== null ||
      existing.expiresAt.getTime() <= Date.now()
    ) {
      throw new UnauthorizedException(
        'Geçersiz veya süresi dolmuş refresh token',
      );
    }

    const newRaw = await this.issueRefreshToken(existing.userId);
    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date(), replacedByToken: this.hash(newRaw) },
    });
    return { rawToken: newRaw, userId: existing.userId };
  }

  /** Tek refresh token'ı revoke eder (logout). Bulunamazsa sessiz geçer. */
  async revokeRefreshToken(rawToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { token: this.hash(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Kullanıcının tüm aktif refresh token'larını revoke eder (revoke-all, reset). */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private hash(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }
}
