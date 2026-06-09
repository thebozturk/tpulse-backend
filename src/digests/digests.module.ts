import { Module } from '@nestjs/common';
import { DigestSchedulerService } from './digest-scheduler.service';
import { TransferAlertService } from './transfer-alert.service';
import { WeeklyDigestService } from './weekly-digest.service';

/**
 * E-posta digest job'ları (cron tetikli). Prisma/Redis/Email global modüllerden
 * gelir; ScheduleModule.forRoot (app.module) SchedulerRegistry sağlar.
 */
@Module({
  providers: [
    WeeklyDigestService,
    TransferAlertService,
    DigestSchedulerService,
  ],
})
export class DigestsModule {}
