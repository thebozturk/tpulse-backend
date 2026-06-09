import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { TransferAlertService } from './transfer-alert.service';
import { WeeklyDigestService } from './weekly-digest.service';

/**
 * Digest cron'larını kaydeder (OutboxDispatcher pattern'i). DIGEST_ENABLED=false
 * ise hiçbir job kaydedilmez — kazara toplu e-posta gönderimi engellenir.
 */
@Injectable()
export class DigestSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(DigestSchedulerService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly scheduler: SchedulerRegistry,
    private readonly weekly: WeeklyDigestService,
    private readonly transferAlert: TransferAlertService,
  ) {}

  onModuleInit(): void {
    if (!this.config.getOrThrow<boolean>('digests.enabled')) {
      this.logger.log('Digest job’ları kapalı (DIGEST_ENABLED=false)');
      return;
    }

    this.register(
      'digest-weekly',
      this.config.getOrThrow<string>('digests.weeklyCron'),
      () => this.weekly.run(),
    );
    this.register(
      'digest-transfer-alert',
      this.config.getOrThrow<string>('digests.transferAlertCron'),
      () => this.transferAlert.run(),
    );
  }

  private register(name: string, expr: string, fn: () => Promise<void>): void {
    const job = new CronJob(expr, () => {
      void fn().catch((err) =>
        this.logger.error(`${name} çalışırken hata: ${err}`),
      );
    });
    this.scheduler.addCronJob(name, job as never);
    job.start();
    this.logger.log(`Digest cron '${name}': ${expr}`);
  }
}
