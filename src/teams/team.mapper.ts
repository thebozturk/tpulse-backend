import { Lang, pickName } from '../common/i18n/lang';
import { TeamDetailWithRel, TeamWithRel } from './team.repository';
import { SquadPlayerDto } from './dto/team-detail.dto';
import { TeamResponseDto } from './dto/team-response.dto';

export function toSquadPlayer(
  player: TeamDetailWithRel['players'][number],
  lang: Lang,
): SquadPlayerDto {
  return {
    id: player.id,
    fullName: `${pickName(lang, player.firstName, player.firstNameTr)} ${pickName(lang, player.lastName, player.lastNameTr)}`,
    photo: player.photo ?? undefined,
    positionName: player.position?.nameEn ?? undefined,
    nationality: player.nationality,
    isFree: player.isFree,
  };
}

export function toTeamResponse(team: TeamWithRel, lang: Lang): TeamResponseDto {
  return {
    id: team.id,
    name: pickName(lang, team.name, team.nameTr),
    nameTr: team.nameTr ?? undefined,
    logo: team.logo ?? undefined,
    leagueId: team.leagueId,
    leagueName: pickName(lang, team.league.name, team.league.nameTr),
    playerCount: team._count.players,
  };
}
