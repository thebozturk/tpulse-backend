import { Lang, pickName } from '../common/i18n/lang';
import { LeagueDetailWithRel, LeagueWithCount } from './league.repository';
import { LeagueResponseDto } from './dto/league-response.dto';

export function toLeagueResponse(
  league: LeagueWithCount,
  lang: Lang,
): LeagueResponseDto {
  return {
    id: league.id,
    name: pickName(lang, league.name, league.nameTr),
    nameTr: league.nameTr ?? undefined,
    country: league.country,
    countryLogo: league.countryLogo ?? undefined,
    leagueLogo: league.leagueLogo,
    leagueCode: league.leagueCode ?? undefined,
    teamCount: league._count.teams,
  };
}

/** Tekil lig detayı: temel alanlar + lige bağlı takımlar (oyuncu sayılarıyla). */
export function toLeagueDetail(
  league: LeagueDetailWithRel,
  lang: Lang,
): LeagueResponseDto {
  return {
    ...toLeagueResponse(league, lang),
    teams: league.teams.map((t) => ({
      id: t.id,
      name: pickName(lang, t.name, t.nameTr),
      nameTr: t.nameTr ?? undefined,
      logo: t.logo ?? undefined,
      playerCount: t._count.players,
    })),
  };
}
