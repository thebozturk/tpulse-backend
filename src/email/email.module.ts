import { Global, Module } from '@nestjs/common';
import { EmailController } from './email.controller';
import { EmailService } from './email.service';
import { resendProvider } from './resend.provider';

@Global()
@Module({
  controllers: [EmailController],
  providers: [resendProvider, EmailService],
  exports: [EmailService],
})
export class EmailModule {}
