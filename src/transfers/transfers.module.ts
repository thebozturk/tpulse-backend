import { Module } from '@nestjs/common';
import { AdminTransfersController } from './admin-transfers.controller';
import { AdminTransfersService } from './admin-transfers.service';
import { PrismaTransferRepository } from './prisma-transfer.repository';
import { RumourController } from './rumour.controller';
import { RumoursService } from './rumours.service';
import { AdminPeriodsService } from './stats/admin-periods.service';
import { AdminTransferPeriodsController } from './stats/admin-transfer-periods.controller';
import { CurrencyConverter } from './stats/currency-converter';
import { PrismaStatsRepository } from './stats/prisma-stats.repository';
import { STATS_REPOSITORY } from './stats/stats.repository';
import { StatsService } from './stats/stats.service';
import { TRANSFER_REPOSITORY } from './transfer.repository';
import { TransferQueryController } from './transfer-query.controller';
import { TransfersService } from './transfers.service';

@Module({
  controllers: [
    TransferQueryController,
    RumourController,
    AdminTransfersController,
    AdminTransferPeriodsController,
  ],
  providers: [
    TransfersService,
    RumoursService,
    StatsService,
    AdminTransfersService,
    AdminPeriodsService,
    CurrencyConverter,
    { provide: TRANSFER_REPOSITORY, useClass: PrismaTransferRepository },
    { provide: STATS_REPOSITORY, useClass: PrismaStatsRepository },
  ],
  exports: [TRANSFER_REPOSITORY],
})
export class TransfersModule {}
