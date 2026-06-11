import { Lang, pickName } from '../common/i18n/lang';
import { PlayerWithRel } from './player.repository';
import { PlayerResponseDto } from './dto/player-response.dto';

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
