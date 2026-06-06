import { Module } from '@nestjs/common';
import { SearchModule } from '../search/search.module';
import { TransfersModule } from '../transfers/transfers.module';
import { AdminPlayersController } from './admin-players.controller';
import { PlayerImageController } from './player-image.controller';
import { PLAYER_REPOSITORY } from './player.repository';
import { PlayersController } from './players.controller';
import { PlayersService } from './players.service';
import { PrismaPlayerRepository } from './prisma-player.repository';

@Module({
  imports: [TransfersModule, SearchModule],
  controllers: [
    PlayersController,
    AdminPlayersController,
    PlayerImageController,
  ],
  providers: [
    PlayersService,
    { provide: PLAYER_REPOSITORY, useClass: PrismaPlayerRepository },
  ],
})
export class PlayersModule {}
