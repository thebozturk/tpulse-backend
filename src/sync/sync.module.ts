import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AxiosFootballDataClient } from '../integration/api-football/axios-football-data.client';
import { FOOTBALL_DATA_CLIENT } from '../integration/api-football/football-data.client';
import { FootballDataSeeder } from '../integration/api-football/football-data.seeder';
import { FootballDataSyncService } from '../integration/api-football/football-data.sync.service';
import { AdminSeedController } from './admin-seed.controller';
import { AdminSyncController } from './admin-sync.controller';
import { SyncCron } from './sync.cron';
import { SYNC_QUEUE, SyncProcessor } from './sync.processor';

@Module({
  imports: [HttpModule, BullModule.registerQueue({ name: SYNC_QUEUE })],
  controllers: [AdminSyncController, AdminSeedController],
  providers: [
    FootballDataSyncService,
    FootballDataSeeder,
    SyncProcessor,
    SyncCron,
    { provide: FOOTBALL_DATA_CLIENT, useClass: AxiosFootballDataClient },
  ],
})
export class SyncModule {}
