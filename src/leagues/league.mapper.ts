import { Lang, pickName } from '../common/i18n/lang';
import { LeagueWithCount } from './league.repository';
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
    countryLogo: league.countryLogo,
    leagueLogo: league.leagueLogo,
    leagueCode: league.leagueCode ?? undefined,
    teamCount: league._count.teams,
  };
}
