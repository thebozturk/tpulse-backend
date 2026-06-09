import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Queue } from 'bullmq';
import { CronJob } from 'cron';
import { PrismaService } from '../common/prisma/prisma.service';
import { OUTBOX_QUEUE } from './events';

const BATCH = 250;
const MAX_RETRY = 10;
const DEFAULT_CRON = '0 */1 * * * *'; // her dakika (sec 0)

/** docs/04: pending outbox mesajlarını BullMQ queue'ya taşır (jobId=messageId → dedup). */
@Injectable()
export class OutboxDispatcher implements OnModuleInit {
  private readonly logger = new Logger(OutboxDispatcher.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly scheduler: SchedulerRegistry,
    @InjectQueue(OUTBOX_QUEUE) private readonly queue: Queue,
  ) {}

  onModuleInit(): void {
    const expr =
      this.config.get<string>('OUTBOX_DISPATCH_CRON') ?? DEFAULT_CRON;
    const job = new CronJob(expr, () => {
      void this.dispatch();
    });
    this.scheduler.addCronJob('outbox-dispatch', job as never);
    job.start();
    this.logger.log(`Outbox dispatcher cron: ${expr}`);
  }

  async dispatch(): Promise<void> {
    // Poison-message görünürlüğü: MAX_RETRY'ı aşmış mesajlar bir daha dispatch
    // edilmez. Sessizce kaybolmaları yerine her tick'te operatöre uyar.
    const dead = await this.prisma.outboxMessage.count({
      where: { processedAtUtc: null, retryCount: { gte: MAX_RETRY } },
    });
    if (dead > 0) {
      this.logger.error(
        `Outbox poison-message: ${dead} mesaj MAX_RETRY(${MAX_RETRY}) aştı, ` +
          'dispatch edilmiyor — manuel müdahale/DLQ gerekli',
      );
    }

    const pending = await this.prisma.outboxMessage.findMany({
      where: { processedAtUtc: null, retryCount: { lt: MAX_RETRY } },
      orderBy: { createdAtUtc: 'asc' },
      take: BATCH,
    });
    if (pending.length === 0) {
      return;
    }
    await Promise.all(
      pending.map((m) =>
        this.queue.add(
          'process',
          { messageId: m.id },
          {
            jobId: m.id,
            attempts: 5,
            backoff: { type: 'exponential', delay: 2000 },
            removeOnComplete: true,
            removeOnFail: 1000,
          },
        ),
      ),
    );
    this.logger.debug(`${pending.length} outbox mesajı kuyruğa alındı`);
  }
}
