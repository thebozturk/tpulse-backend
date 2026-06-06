import { Module } from '@nestjs/common';
import { PrismaTransferRepository } from './prisma-transfer.repository';
import { RumourController } from './rumour.controller';
import { RumoursService } from './rumours.service';
import { CurrencyConverter } from './stats/currency-converter';
import { PrismaStatsRepository } from './stats/prisma-stats.repository';
import { STATS_REPOSITORY } from './stats/stats.repository';
import { StatsService } from './stats/stats.service';
import { TRANSFER_REPOSITORY } from './transfer.repository';
import { TransferQueryController } from './transfer-query.controller';
import { TransfersService } from './transfers.service';

@Module({
  controllers: [TransferQueryController, RumourController],
  providers: [
    TransfersService,
    RumoursService,
    StatsService,
    CurrencyConverter,
    { provide: TRANSFER_REPOSITORY, useClass: PrismaTransferRepository },
    { provide: STATS_REPOSITORY, useClass: PrismaStatsRepository },
  ],
  exports: [TRANSFER_REPOSITORY],
})
export class TransfersModule {}
