import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

/** DI token — RESEND_API_KEY yoksa null enjekte edilir (dev: gönderim yerine log). */
export const RESEND_CLIENT = 'RESEND_CLIENT';

export const resendProvider: Provider = {
  provide: RESEND_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService): Resend | null => {
    const apiKey = config.get<string>('resend.apiKey');
    return apiKey ? new Resend(apiKey) : null;
  },
};
