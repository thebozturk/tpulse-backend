import { Module } from '@nestjs/common';
import { TransfersModule } from '../transfers/transfers.module';
import { LeaguesController } from './leagues.controller';
import { LeaguesService } from './leagues.service';
import { LEAGUE_REPOSITORY } from './league.repository';
import { PrismaLeagueRepository } from './prisma-league.repository';

@Module({
  imports: [TransfersModule],
  controllers: [LeaguesController],
  providers: [
    LeaguesService,
    { provide: LEAGUE_REPOSITORY, useClass: PrismaLeagueRepository },
  ],
})
export class LeaguesModule {}
