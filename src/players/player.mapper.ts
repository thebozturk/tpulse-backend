import { Lang, pickName } from '../common/i18n/lang';
import { PlayerDetailWithRel, PlayerWithRel } from './player.repository';
import { PlayerResponseDto } from './dto/player-response.dto';
import { PlayerStatisticDto } from './dto/player-statistic.dto';

function toPlayerStatistic(
  s: PlayerDetailWithRel['statistics'][number],
  lang: Lang,
): PlayerStatisticDto {
  return {
    season: s.season,
    leagueId: s.leagueId ?? undefined,
    leagueExternalId: s.leagueExternalId,
    leagueName: s.league
      ? pickName(lang, s.league.name, s.league.nameTr)
      : undefined,
    leagueLogo: s.league?.leagueLogo ?? undefined,
    teamId: s.teamId ?? undefined,
    teamName: s.team ? pickName(lang, s.team.name, s.team.nameTr) : undefined,
    teamLogo: s.team?.logo ?? undefined,
    appearances: s.appearances ?? undefined,
    lineups: s.lineups ?? undefined,
    minutes: s.minutes ?? undefined,
    rating: s.rating != null ? Number(s.rating) : undefined,
    captain: s.captain,
    goalsTotal: s.goalsTotal ?? undefined,
    goalsConceded: s.goalsConceded ?? undefined,
    goalsAssists: s.goalsAssists ?? undefined,
    goalsSaves: s.goalsSaves ?? undefined,
    shotsTotal: s.shotsTotal ?? undefined,
    shotsOn: s.shotsOn ?? undefined,
    passesTotal: s.passesTotal ?? undefined,
    passesKey: s.passesKey ?? undefined,
    passesAccuracy: s.passesAccuracy ?? undefined,
    tacklesTotal: s.tacklesTotal ?? undefined,
    tacklesBlocks: s.tacklesBlocks ?? undefined,
    tacklesInterceptions: s.tacklesInterceptions ?? undefined,
    duelsTotal: s.duelsTotal ?? undefined,
    duelsWon: s.duelsWon ?? undefined,
    dribblesAttempts: s.dribblesAttempts ?? undefined,
    dribblesSuccess: s.dribblesSuccess ?? undefined,
    foulsDrawn: s.foulsDrawn ?? undefined,
    foulsCommitted: s.foulsCommitted ?? undefined,
    cardsYellow: s.cardsYellow ?? undefined,
    cardsYellowRed: s.cardsYellowRed ?? undefined,
    cardsRed: s.cardsRed ?? undefined,
    penaltyWon: s.penaltyWon ?? undefined,
    penaltyCommitted: s.penaltyCommitted ?? undefined,
    penaltyScored: s.penaltyScored ?? undefined,
    penaltyMissed: s.penaltyMissed ?? undefined,
    penaltySaved: s.penaltySaved ?? undefined,
  };
}

/** Tekil futbolcu detayı: temel alanlar + tüm lig×sezon istatistikleri. */
export function toPlayerDetail(
  player: PlayerDetailWithRel,
  lang: Lang,
): PlayerResponseDto {
  return {
    ...toPlayerResponse(player, lang),
    statistics: player.statistics.map((s) => toPlayerStatistic(s, lang)),
  };
}

export function toPlayerResponse(
  player: PlayerWithRel,
  lang: Lang,
): PlayerResponseDto {
  const firstName = pickName(lang, player.firstName, player.firstNameTr);
  const lastName = pickName(lang, player.lastName, player.lastNameTr);
  return {
    id: player.id,
    firstName,
    lastName,
    firstNameTr: player.firstNameTr ?? undefined,
    lastNameTr: player.lastNameTr ?? undefined,
    fullName: `${firstName} ${lastName}`,
    nationality: player.nationality,
    birthDate: player.birthDate ?? undefined,
    height: player.height ?? undefined,
    weight: player.weight ?? undefined,
    photo: player.photo ?? undefined,
    birthPlace: player.birthPlace ?? undefined,
    birthCountry: player.birthCountry ?? undefined,
    isFree: player.isFree,
    teamId: player.teamId,
    teamName: pickName(lang, player.team.name, player.team.nameTr),
    teamLogo: player.team.logo ?? undefined,
    positionId: player.positionId ?? undefined,
    positionName: player.position?.nameEn ?? undefined,
  };
}
