import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { FootballDataSyncService } from '../integration/api-football/football-data.sync.service';

export const SYNC_QUEUE = 'sync';

@Processor(SYNC_QUEUE)
export class SyncProcessor extends WorkerHost {
  private readonly logger = new Logger(SyncProcessor.name);

  constructor(private readonly sync: FootballDataSyncService) {
    super();
  }

  async process(job: Job<{ leagueExternalId?: number }>): Promise<void> {
    this.logger.log(`Sync job başladı: ${job.id}`);
    const runId = await this.sync.syncAll(job.data.leagueExternalId);
    this.logger.log(`Sync tamamlandı, SyncRun: ${runId}`);
  }
}
