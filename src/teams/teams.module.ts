import { Module } from '@nestjs/common';
import { PrismaTeamRepository } from './prisma-team.repository';
import { TEAM_REPOSITORY } from './team.repository';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';

@Module({
  controllers: [TeamsController],
  providers: [
    TeamsService,
    { provide: TEAM_REPOSITORY, useClass: PrismaTeamRepository },
  ],
})
export class TeamsModule {}
