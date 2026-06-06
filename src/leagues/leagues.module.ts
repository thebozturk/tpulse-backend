import { Module } from '@nestjs/common';
import { LeaguesController } from './leagues.controller';
import { LeaguesService } from './leagues.service';
import { LEAGUE_REPOSITORY } from './league.repository';
import { PrismaLeagueRepository } from './prisma-league.repository';

@Module({
  controllers: [LeaguesController],
  providers: [
    LeaguesService,
    { provide: LEAGUE_REPOSITORY, useClass: PrismaLeagueRepository },
  ],
})
export class LeaguesModule {}
