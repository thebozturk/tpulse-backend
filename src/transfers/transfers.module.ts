import { Module } from '@nestjs/common';
import { PrismaTransferRepository } from './prisma-transfer.repository';
import { RumourController } from './rumour.controller';
import { RumoursService } from './rumours.service';
import { TRANSFER_REPOSITORY } from './transfer.repository';
import { TransferQueryController } from './transfer-query.controller';
import { TransfersService } from './transfers.service';

@Module({
  controllers: [TransferQueryController, RumourController],
  providers: [
    TransfersService,
    RumoursService,
    { provide: TRANSFER_REPOSITORY, useClass: PrismaTransferRepository },
  ],
  exports: [TRANSFER_REPOSITORY],
})
export class TransfersModule {}
