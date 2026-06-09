import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { EmailService } from '../email/email.service';

/** E-posta doğrulama akışı: token üret/gönder → doğrula → isMailConfirm=true. */
@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
  ) {}

  /** Doğrulama tokenı üretir, hash'ler ve doğrulama e-postasını gönderir. */
  async send(user: Pick<User, 'id' | 'email' | 'nickname'>): Promise<void> {
    const raw = crypto.randomBytes(32).toString('hex');
    const minutes = this.config.getOrThrow<number>('emailVerify.tokenMinutes');
    await this.prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(raw),
        expiresAt: new Date(Date.now() + minutes * 60 * 1000),
      },
    });

    const base = this.config.getOrThrow<string>('emailVerify.urlBase');
    const verifyUrl = `${base}?email=${encodeURIComponent(user.email)}&token=${encodeURIComponent(raw)}`;
    await this.email.sendVerifyEmail(user.email, {
      name: user.nickname,
      verifyUrl,
      expiresInMinutes: minutes,
    });
  }

  /**
   * Tokenı doğrular → isMailConfirm=true + token kullanıldı işaretle.
   * Zaten doğrulanmışsa idempotent (sessiz başarı). Geçersiz token → 400.
   */
  async verify(email: string, token: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new BadRequestException('Geçersiz doğrulama bağlantısı');
    }
    if (user.isMailConfirm) {
      return; // idempotent — zaten doğrulanmış
    }

    const record = await this.prisma.emailVerificationToken.findFirst({
      where: {
        userId: user.id,
        tokenHash: this.hashToken(token),
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!record) {
      throw new BadRequestException(
        'Geçersiz veya süresi dolmuş doğrulama bağlantısı',
      );
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { isMailConfirm: true, updatedAt: new Date() },
      }),
      this.prisma.emailVerificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);
    this.logger.log(`E-posta doğrulandı: ${user.id}`);

    // Doğrulama sonrası hoş geldin — best-effort, doğrulama akışını bloklamaz.
    try {
      await this.email.sendWelcome(user.email, { name: user.nickname });
    } catch (err) {
      this.logger.warn(
        `Hoş geldin e-postası gönderilemedi (${user.id}): ${err}`,
      );
    }
  }

  /**
   * Doğrulama e-postasını yeniden gönderir. Enumeration-safe: kullanıcı yoksa
   * veya zaten doğrulanmışsa sessizce hiçbir şey yapmaz (controller her zaman 200).
   */
  async resend(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      this.logger.debug(`Doğrulama tekrar istendi ama kullanıcı yok: ${email}`);
      return;
    }
    if (user.isMailConfirm) {
      this.logger.debug(
        `Doğrulama tekrar istendi ama zaten doğrulanmış: ${user.id}`,
      );
      return;
    }
    await this.send(user);
  }

  private hashToken(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }
}
