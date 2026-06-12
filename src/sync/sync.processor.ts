import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { FootballDataSyncService } from '../integration/api-football/football-data.sync.service';

export const SYNC_QUEUE = 'sync';

interface SyncJobData {
  /** Tek lig (admin endpoint). Verilirse sadece bu lig senkronlanır. */
  leagueExternalId?: number;
  /** Açık lig alt kümesi — quota resume devam job'ı bunu taşır. */
  leagueExternalIds?: number[];
}

/** Quota tükenince kalan ligleri ertesi UTC gününe erteler (+5dk tampon). */
function msUntilNextUtcReset(): number {
  const now = new Date();
  const next = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0,
      5,
      0,
    ),
  );
  return next.getTime() - now.getTime();
}

@Processor(SYNC_QUEUE)
export class SyncProcessor extends WorkerHost {
  private readonly logger = new Logger(SyncProcessor.name);

  constructor(
    private readonly sync: FootballDataSyncService,
    @InjectQueue(SYNC_QUEUE) private readonly queue: Queue,
  ) {
    super();
  }

  async process(job: Job<SyncJobData>): Promise<void> {
    this.logger.log(`Sync job başladı: ${job.id}`);
    const explicit =
      job.data.leagueExternalIds ??
      (job.data.leagueExternalId !== undefined
        ? [job.data.leagueExternalId]
        : undefined);

    const { runId, remaining } = await this.sync.syncAll({
      leagueExternalIds: explicit,
    });

    if (remaining.length > 0) {
      const delay = msUntilNextUtcReset();
      await this.queue.add('sync', { leagueExternalIds: remaining }, { delay });
      this.logger.warn(
        `Quota: ${remaining.length} lig ertelendi (~${Math.round(delay / 3_600_000)}s sonra), SyncRun: ${runId}`,
      );
      return;
    }
    this.logger.log(`Sync tamamlandı, SyncRun: ${runId}`);
  }
}
