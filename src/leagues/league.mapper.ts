import { LeagueWithCount } from './league.repository';
import { LeagueResponseDto } from './dto/league-response.dto';

export function toLeagueResponse(league: LeagueWithCount): LeagueResponseDto {
  return {
    id: league.id,
    name: league.name,
    country: league.country,
    countryLogo: league.countryLogo,
    leagueLogo: league.leagueLogo,
    leagueCode: league.leagueCode ?? undefined,
    teamCount: league._count.teams,
  };
}
