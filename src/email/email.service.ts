import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { Resend } from 'resend';

import { PrismaService } from '../common/prisma/prisma.service';
import { LAUNCH_EMAIL_CONTENT } from './launch.content';
import { RESEND_CLIENT } from './resend.provider';
import {
  renderAccountBannedEmail,
  renderAccountSuspendedEmail,
  renderBroadcastEmail,
  renderLaunchEmail,
  renderEmailChangeConfirmEmail,
  renderEngagementDigestEmail,
  renderPasswordChangedEmail,
  renderPasswordResetEmail,
  renderReportReviewedEmail,
  renderTransferAlertEmail,
  renderVerifyEmail,
  renderWeeklyDigestEmail,
  renderWelcomeEmail,
  type RenderedEmail,
  type AccountBannedEmailProps,
  type AccountSuspendedEmailProps,
  type BroadcastEmailProps,
  type EmailChangeConfirmEmailProps,
  type EngagementDigestEmailProps,
  type PasswordChangedEmailProps,
  type ReportReviewedEmailProps,
  type TransferAlertEmailProps,
  type VerifyEmailProps,
  type WeeklyDigestEmailProps,
  type WelcomeEmailProps,
} from './templates';

/**
 * assetBaseUrl + unsubscribeUrl her e-postada servis tarafından doldurulur;
 * çağıran sadece domain alanlarını verir.
 */
type BrandInjected = 'assetBaseUrl' | 'unsubscribeUrl';
type DomainProps<T> = Omit<T, BrandInjected>;
/** Belirli alanları (ör. servis tarafından default'lanan URL'ler) opsiyonel yapar. */
type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    @Inject(RESEND_CLIENT) private readonly resend: Resend | null,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private get from(): string {
    return this.config.getOrThrow<string>('resend.from');
  }

  private get assetBaseUrl(): string {
    return this.config.getOrThrow<string>('email.assetBaseUrl');
  }

  private get webUrl(): string {
    return this.config.getOrThrow<string>('email.webUrl');
  }

  // ─── Abonelikten çıkma (stateless imzalı token) ─────────────────────────

  /**
   * Abonelikten çıkma linki — frontend onay sayfasına imzalı token taşır.
   * Token e-posta üzerinden HMAC ile imzalanır (DB'siz, tahrif edilemez).
   * Sayfa `POST /api/email/unsubscribe { token }` çağırır.
   */
  private unsubscribeUrl(email: string): string {
    const payload = Buffer.from(email, 'utf8').toString('base64url');
    return `${this.webUrl}/abonelik/cik?token=${payload}.${this.signEmail(email)}`;
  }

  /** Domain-ayrımlı HMAC imzası (jwt.secret anahtarıyla). */
  private signEmail(email: string): string {
    return crypto
      .createHmac('sha256', this.config.getOrThrow<string>('jwt.secret'))
      .update(`unsub:v1:${email}`)
      .digest('base64url');
  }

  /** Tokenı doğrular; geçerliyse e-postayı, değilse null döner (timing-safe). */
  private verifyUnsubscribeToken(token: string): string | null {
    const [payload, sig] = token.split('.');
    if (!payload || !sig) return null;
    let email: string;
    try {
      email = Buffer.from(payload, 'base64url').toString('utf8');
    } catch {
      return null;
    }
    const expected = this.signEmail(email);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return null;
    }
    return email;
  }

  /**
   * Abonelikten çıkma onayı: tokenı doğrula → kullanıcının emailOptOut=true.
   * Geçersiz token → 400. Bilinmeyen e-posta → sessiz başarı (idempotent).
   */
  async unsubscribe(token: string): Promise<void> {
    const email = this.verifyUnsubscribeToken(token);
    if (!email) {
      throw new BadRequestException('Geçersiz abonelik bağlantısı');
    }
    await this.prisma.user.updateMany({
      where: { email, emailOptOut: false },
      data: { emailOptOut: true, updatedAt: new Date() },
    });
    // Landing waitlist abonesi de olabilir (kayıtlı kullanıcı olmadan) — onu da
    // işaretle ki lansman/pazarlama maili gitmesin.
    await this.prisma.waitlistSubscriber.updateMany({
      where: { email, status: 'subscribed' },
      data: { status: 'unsubscribed' },
    });
    this.logger.log(`E-posta aboneliğinden çıkıldı: ${email}`);
  }

  /** Kullanıcı digest/pazarlama e-postalarından çıkmış mı? */
  private async isOptedOut(email: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { emailOptOut: true },
    });
    return user?.emailOptOut ?? false;
  }

  /**
   * Render edilmiş e-postayı Resend ile gönderir. RESEND_API_KEY yoksa
   * göndermez — konu + alıcı LOG'a yazılır, akış kesilmez.
   */
  private async dispatch(
    to: string,
    rendered: RenderedEmail,
    devNote?: string,
  ): Promise<void> {
    if (!this.resend) {
      // devNote reset/doğrulama URL'i (ham token) içerebilir — ÜRETİMDE ASLA
      // log'lama. Prod'da Resend kapalıysa bu bir yanlış konfigürasyondur:
      // token'sız uyarı bas (sızıntı yok, sorun görünür kalsın).
      if (process.env.NODE_ENV === 'production') {
        this.logger.warn(
          `E-posta gönderilemiyor (RESEND_API_KEY tanımsız): "${rendered.subject}" → ${to}`,
        );
      } else {
        this.logger.log(
          `[EMAIL DISABLED] "${rendered.subject}" → ${to}${devNote ? ` · ${devNote}` : ''}`,
        );
      }
      return;
    }
    const { error } = await this.resend.emails.send({
      from: this.from,
      to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      // RFC 8058 tek-tık abonelikten çıkma — Gmail/Yahoo toplu gönderim
      // gereksinimi; inbox teslimini ciddi iyileştirir, spam'i azaltır.
      headers: {
        'List-Unsubscribe': `<${this.unsubscribeUrl(to)}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });
    if (error) {
      throw new Error(`Resend gönderim hatası: ${error.message}`);
    }
    this.logger.log(`E-posta gönderildi: "${rendered.subject}" → ${to}`);
  }

  // ─── Auth / hesap ───────────────────────────────────────────────────────

  /** Kayıt sonrası hoş geldin. ctaUrl verilmezse `${webUrl}/kesfet`. */
  async sendWelcome(
    to: string,
    props: Optional<DomainProps<WelcomeEmailProps>, 'ctaUrl'>,
  ): Promise<void> {
    await this.dispatch(
      to,
      await renderWelcomeEmail({
        ctaUrl: `${this.webUrl}/kesfet`,
        ...props,
        assetBaseUrl: this.assetBaseUrl,
        unsubscribeUrl: this.unsubscribeUrl(to),
      }),
    );
  }

  /** E-posta doğrulama. */
  async sendVerifyEmail(
    to: string,
    props: DomainProps<VerifyEmailProps>,
  ): Promise<void> {
    await this.dispatch(
      to,
      await renderVerifyEmail({
        ...props,
        assetBaseUrl: this.assetBaseUrl,
        unsubscribeUrl: this.unsubscribeUrl(to),
      }),
      props.verifyUrl,
    );
  }

  /**
   * Şifre sıfırlama linki. resetUrl + geçerlilik süresi config'ten kurulur.
   * Resend kapalıysa (RESEND_API_KEY yok) link LOG'a yazılır (akış yine çalışır).
   */
  async sendPasswordReset(
    email: string,
    rawToken: string,
    name: string,
  ): Promise<void> {
    const base = this.config.getOrThrow<string>('passwordReset.urlBase');
    const minutes = this.config.getOrThrow<number>(
      'passwordReset.tokenMinutes',
    );
    const resetUrl = `${base}?email=${encodeURIComponent(email)}&token=${encodeURIComponent(rawToken)}`;

    await this.dispatch(
      email,
      await renderPasswordResetEmail({
        name,
        resetUrl,
        expiresInMinutes: minutes,
        assetBaseUrl: this.assetBaseUrl,
        unsubscribeUrl: this.unsubscribeUrl(email),
      }),
      resetUrl,
    );
  }

  /** Şifre değiştirildi güvenlik bildirimi. supportUrl verilmezse `${webUrl}/destek`. */
  async sendPasswordChanged(
    to: string,
    props: Optional<DomainProps<PasswordChangedEmailProps>, 'supportUrl'>,
  ): Promise<void> {
    await this.dispatch(
      to,
      await renderPasswordChangedEmail({
        supportUrl: `${this.webUrl}/destek`,
        ...props,
        assetBaseUrl: this.assetBaseUrl,
        unsubscribeUrl: this.unsubscribeUrl(to),
      }),
    );
  }

  /** Yeni e-posta adresi onayı. */
  async sendEmailChangeConfirm(
    to: string,
    props: DomainProps<EmailChangeConfirmEmailProps>,
  ): Promise<void> {
    await this.dispatch(
      to,
      await renderEmailChangeConfirmEmail({
        ...props,
        assetBaseUrl: this.assetBaseUrl,
        unsubscribeUrl: this.unsubscribeUrl(to),
      }),
      props.confirmUrl,
    );
  }

  // ─── Moderasyon ─────────────────────────────────────────────────────────

  /** Hesap askıya alındı. appealUrl verilmezse `${webUrl}/itiraz`. */
  async sendAccountSuspended(
    to: string,
    props: Optional<DomainProps<AccountSuspendedEmailProps>, 'appealUrl'>,
  ): Promise<void> {
    await this.dispatch(
      to,
      await renderAccountSuspendedEmail({
        appealUrl: `${this.webUrl}/itiraz`,
        ...props,
        assetBaseUrl: this.assetBaseUrl,
        unsubscribeUrl: this.unsubscribeUrl(to),
      }),
    );
  }

  /** Hesap kalıcı olarak kapatıldı (ban). appealUrl verilmezse `${webUrl}/itiraz`. */
  async sendAccountBanned(
    to: string,
    props: Optional<DomainProps<AccountBannedEmailProps>, 'appealUrl'>,
  ): Promise<void> {
    await this.dispatch(
      to,
      await renderAccountBannedEmail({
        appealUrl: `${this.webUrl}/itiraz`,
        ...props,
        assetBaseUrl: this.assetBaseUrl,
        unsubscribeUrl: this.unsubscribeUrl(to),
      }),
    );
  }

  /** Şikayet/moderasyon sonucu. */
  async sendReportReviewed(
    to: string,
    props: DomainProps<ReportReviewedEmailProps>,
  ): Promise<void> {
    await this.dispatch(
      to,
      await renderReportReviewedEmail({
        ...props,
        assetBaseUrl: this.assetBaseUrl,
        unsubscribeUrl: this.unsubscribeUrl(to),
      }),
    );
  }

  // ─── Etkileşim / digest ─────────────────────────────────────────────────

  // Not: aşağıdaki 4 tip non-transactional (digest/pazarlama) — emailOptOut'a
  // saygı duyar. Transactional tipler (reset/verify/ban/şikayet) opt-out'tan
  // etkilenmez; her zaman gönderilir.

  /** Favori takım/oyuncu transfer & söylenti bildirimi. */
  async sendTransferAlert(
    to: string,
    props: DomainProps<TransferAlertEmailProps>,
  ): Promise<void> {
    if (await this.skipOptedOut(to)) return;
    await this.dispatch(
      to,
      await renderTransferAlertEmail({
        ...props,
        assetBaseUrl: this.assetBaseUrl,
        unsubscribeUrl: this.unsubscribeUrl(to),
      }),
    );
  }

  /** Yorum yanıtı / reaksiyon özeti. */
  async sendEngagementDigest(
    to: string,
    props: DomainProps<EngagementDigestEmailProps>,
  ): Promise<void> {
    if (await this.skipOptedOut(to)) return;
    await this.dispatch(
      to,
      await renderEngagementDigestEmail({
        ...props,
        assetBaseUrl: this.assetBaseUrl,
        unsubscribeUrl: this.unsubscribeUrl(to),
      }),
    );
  }

  /** Haftalık özet (Pulse Score + sıralama + öne çıkan transferler). */
  async sendWeeklyDigest(
    to: string,
    props: DomainProps<WeeklyDigestEmailProps>,
  ): Promise<void> {
    if (await this.skipOptedOut(to)) return;
    await this.dispatch(
      to,
      await renderWeeklyDigestEmail({
        ...props,
        assetBaseUrl: this.assetBaseUrl,
        unsubscribeUrl: this.unsubscribeUrl(to),
      }),
    );
  }

  /** Admin duyuru / broadcast. */
  async sendBroadcast(
    to: string,
    props: DomainProps<BroadcastEmailProps>,
  ): Promise<void> {
    if (await this.skipOptedOut(to)) return;
    await this.dispatch(
      to,
      await renderBroadcastEmail({
        ...props,
        assetBaseUrl: this.assetBaseUrl,
        unsubscribeUrl: this.unsubscribeUrl(to),
      }),
    );
  }

  /**
   * Waitlist lansman duyurusu — içeriği backend'de sabittir (launch.content.ts).
   * Çağıran sadece alıcıyı verir; konu/gövde/CTA buradan kurulur. Opt-out'a
   * saygılıdır (pazarlama tipi).
   */
  async sendLaunch(to: string): Promise<void> {
    if (await this.skipOptedOut(to)) return;
    await this.dispatch(
      to,
      await renderLaunchEmail({
        ctaUrl: LAUNCH_EMAIL_CONTENT.ctaUrl,
        assetBaseUrl: this.assetBaseUrl,
        unsubscribeUrl: this.unsubscribeUrl(to),
      }),
    );
  }

  /** Opt-out olduysa logla ve true dön (gönderim atlanır). */
  private async skipOptedOut(email: string): Promise<boolean> {
    if (await this.isOptedOut(email)) {
      this.logger.debug(`E-posta opt-out, atlandı: ${email}`);
      return true;
    }
    return false;
  }
}
