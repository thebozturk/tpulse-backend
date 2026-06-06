import { Module } from '@nestjs/common';
import { AuditLogsController } from './audit-logs.controller';

/** AuditService AuditModule (@Global) üzerinden gelir — burada sadece controller. */
@Module({
  controllers: [AuditLogsController],
})
export class AuditLogsModule {}
