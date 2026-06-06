import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditInterceptor } from './audit.interceptor';
import { AuditService } from './audit.service';

/**
 * Audit altyapısı. AuditInterceptor global (APP_INTERCEPTOR) — @Audit'li uçları yakalar.
 * AuditService explicit kullanım için export edilir (ör. report.review zengin metadata).
 * PrismaService @Global olduğundan ek import gerekmez.
 */
@Global()
@Module({
  providers: [
    AuditService,
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
  exports: [AuditService],
})
export class AuditModule {}
