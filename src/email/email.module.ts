import { MailerModule } from '@nestjs-modules/mailer';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

@Global()
@Module({
  imports: [
    MailerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const host = config.get<string>('smtp.host');
        return {
          // SMTP_HOST boşsa jsonTransport: gerçek gönderim yapmaz (EmailService log'lar).
          transport: host
            ? {
                host,
                port: config.get<number>('smtp.port'),
                secure: config.get<boolean>('smtp.secure'),
                auth: {
                  user: config.get<string>('smtp.username'),
                  pass: config.get<string>('smtp.password'),
                },
              }
            : { jsonTransport: true },
          defaults: { from: config.get<string>('smtp.from') },
        };
      },
    }),
  ],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
