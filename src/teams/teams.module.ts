import { Module } from '@nestjs/common';
import { TransfersModule } from '../transfers/transfers.module';
import { AdminTeamsController } from './admin-teams.controller';
import { PrismaTeamRepository } from './prisma-team.repository';
import { TeamImageController } from './team-image.controller';
import { TEAM_REPOSITORY } from './team.repository';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';

@Module({
  imports: [TransfersModule],
  controllers: [TeamsController, AdminTeamsController, TeamImageController],
  providers: [
    TeamsService,
    { provide: TEAM_REPOSITORY, useClass: PrismaTeamRepository },
  ],
})
export class TeamsModule {}
