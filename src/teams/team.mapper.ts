import { TeamDetailWithRel, TeamWithRel } from './team.repository';
import { SquadPlayerDto } from './dto/team-detail.dto';
import { TeamResponseDto } from './dto/team-response.dto';

export function toSquadPlayer(
  player: TeamDetailWithRel['players'][number],
): SquadPlayerDto {
  return {
    id: player.id,
    fullName: `${player.firstName} ${player.lastName}`,
    photo: player.photo ?? undefined,
    positionName: player.position?.nameEn ?? undefined,
    nationality: player.nationality,
    isFree: player.isFree,
  };
}

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
