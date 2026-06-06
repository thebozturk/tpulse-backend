import { Module } from '@nestjs/common';
import { TransfersModule } from '../transfers/transfers.module';
import { PLAYER_REPOSITORY } from './player.repository';
import { PlayersController } from './players.controller';
import { PlayersService } from './players.service';
import { PrismaPlayerRepository } from './prisma-player.repository';

@Module({
  imports: [TransfersModule],
  controllers: [PlayersController],
  providers: [
    PlayersService,
    { provide: PLAYER_REPOSITORY, useClass: PrismaPlayerRepository },
  ],
})
export class PlayersModule {}
