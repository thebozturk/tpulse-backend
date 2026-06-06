import { MailerService } from '@nestjs-modules/mailer';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly enabled: boolean;

  constructor(
    private readonly mailer: MailerService,
    private readonly config: ConfigService,
  ) {
    this.enabled = !!this.config.get<string>('smtp.host');
  }

  /**
   * Şifre sıfırlama linkini gönderir. SMTP yapılandırılmamışsa (docs/04
   * Email:Enabled=false) link LOG'a yazılır — akış yine çalışır.
   */
  async sendPasswordReset(email: string, rawToken: string): Promise<void> {
    const base = this.config.getOrThrow<string>('passwordReset.urlBase');
    const link = `${base}?email=${encodeURIComponent(email)}&token=${encodeURIComponent(rawToken)}`;

    if (!this.enabled) {
      this.logger.log(
        `[EMAIL DISABLED] Şifre sıfırlama linki (${email}): ${link}`,
      );
      return;
    }

    await this.mailer.sendMail({
      to: email,
      subject: 'TransferPulse — Şifre Sıfırlama',
      html: `<p>Şifrenizi sıfırlamak için <a href="${link}">buraya tıklayın</a>.</p>
             <p>Bu link ile gelmediyseniz bu e-postayı yok sayın.</p>`,
    });
    this.logger.log(`Şifre sıfırlama e-postası gönderildi: ${email}`);
  }
}
