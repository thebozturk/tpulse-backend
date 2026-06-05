import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { TokenService } from './token.service';

const BCRYPT_ROUNDS = 12;

/** Parola hash/verify + şifre sıfırlama akışı (docs/04 §1). */
@Injectable()
export class PasswordService {
  private readonly logger = new Logger(PasswordService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
    private readonly tokens: TokenService,
  ) {}

  hash(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  verify(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /** Enumeration-safe: kullanıcı yoksa bile sessiz başarı (controller her zaman 200). */
  async requestReset(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      this.logger.debug(`Reset istendi ama kullanıcı yok: ${email}`);
      return;
    }

    const raw = crypto.randomBytes(32).toString('hex');
    const minutes = this.config.getOrThrow<number>(
      'passwordReset.tokenMinutes',
    );
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(raw),
        expiresAt: new Date(Date.now() + minutes * 60 * 1000),
      },
    });
    await this.email.sendPasswordReset(email, raw);
  }

  /** Token doğrula → parola güncelle → kullanıldı işaretle → tüm refresh revoke. */
  async reset(
    email: string,
    token: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new BadRequestException('Geçersiz token');
    }

    const record = await this.prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        tokenHash: this.hashToken(token),
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!record) {
      throw new BadRequestException('Geçersiz veya süresi dolmuş token');
    }

    const passwordHash = await this.hash(newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash, updatedAt: new Date() },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);
    await this.tokens.revokeAllForUser(user.id);
  }

  private hashToken(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }
}
