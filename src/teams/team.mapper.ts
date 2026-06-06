import { TeamWithRel } from './team.repository';
import { TeamResponseDto } from './dto/team-response.dto';

export function toTeamResponse(team: TeamWithRel): TeamResponseDto {
  return {
    id: team.id,
    name: team.name,
    logo: team.logo ?? undefined,
    leagueId: team.leagueId,
    leagueName: team.league.name,
    playerCount: team._count.players,
  };
}
