import { Lang, pickName } from '../common/i18n/lang';
import { TeamDetailWithRel, TeamWithRel } from './team.repository';
import {
  SquadPlayerDto,
  SquadPlayerStatsDto,
  TeamSeasonTotalsDto,
} from './dto/team-detail.dto';
import { TeamResponseDto } from './dto/team-response.dto';

type SquadStat = TeamDetailWithRel['players'][number]['statistics'][number];

/** Oyuncunun bu ligdeki en güncel sezon stat satırı (yoksa undefined). */
function pickLeagueStat(
  stats: SquadStat[],
  leagueId: string,
): SquadStat | undefined {
  return stats
    .filter((s) => s.leagueId === leagueId)
    .sort((a, b) => b.season - a.season)[0];
}

export function toSquadPlayer(
  player: TeamDetailWithRel['players'][number],
  lang: Lang,
  leagueId: string,
): SquadPlayerDto {
  const st = pickLeagueStat(player.statistics, leagueId);
  const stats: SquadPlayerStatsDto | undefined = st
    ? {
        season: st.season,
        appearances: st.appearances ?? undefined,
        minutes: st.minutes ?? undefined,
        goals: st.goalsTotal ?? undefined,
        assists: st.goalsAssists ?? undefined,
        rating: st.rating != null ? Number(st.rating) : undefined,
        yellowCards: st.cardsYellow ?? undefined,
        redCards: st.cardsRed ?? undefined,
      }
    : undefined;
  return {
    id: player.id,
    fullName: `${pickName(lang, player.firstName, player.firstNameTr)} ${pickName(lang, player.lastName, player.lastNameTr)}`,
    photo: player.photo ?? undefined,
    positionName: player.position?.nameEn ?? undefined,
    nationality: player.nationality,
    isFree: player.isFree,
    birthDate: player.birthDate ?? undefined,
    height: player.height ?? undefined,
    weight: player.weight ?? undefined,
    stats,
  };
}

/** Kadronun bu ligdeki güncel sezon toplamı (en güncel sezona göre). */
export function computeTeamSeasonTotals(
  players: TeamDetailWithRel['players'],
  leagueId: string,
): TeamSeasonTotalsDto | undefined {
  const stats = players
    .map((p) => pickLeagueStat(p.statistics, leagueId))
    .filter((s): s is SquadStat => s !== undefined);
  if (stats.length === 0) {
    return undefined;
  }
  const season = Math.max(...stats.map((s) => s.season));
  const current = stats.filter((s) => s.season === season);
  return {
    season,
    goals: current.reduce((n, s) => n + (s.goalsTotal ?? 0), 0),
    assists: current.reduce((n, s) => n + (s.goalsAssists ?? 0), 0),
    yellowCards: current.reduce((n, s) => n + (s.cardsYellow ?? 0), 0),
    redCards: current.reduce((n, s) => n + (s.cardsRed ?? 0), 0),
    playersWithStats: current.length,
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
