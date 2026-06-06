import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Queue } from 'bullmq';
import { CronJob } from 'cron';
import { SYNC_QUEUE } from './sync.processor';

/** SYNC_CRON ayarlıysa periyodik sync job'ı kuyruğa alır (opsiyonel). */
@Injectable()
export class SyncCron implements OnModuleInit {
  private readonly logger = new Logger(SyncCron.name);

  constructor(
    private readonly config: ConfigService,
    private readonly scheduler: SchedulerRegistry,
    @InjectQueue(SYNC_QUEUE) private readonly queue: Queue,
  ) {}

  onModuleInit(): void {
    const expr = this.config.get<string>('apiFootball.syncCron');
    if (!expr) {
      return;
    }
    const job = new CronJob(expr, () => {
      void this.queue.add('sync', {});
    });
    this.scheduler.addCronJob('football-sync', job as never);
    job.start();
    this.logger.log(`Football sync cron: ${expr}`);
  }
}
