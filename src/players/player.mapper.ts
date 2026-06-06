import { PlayerWithRel } from './player.repository';
import { PlayerResponseDto } from './dto/player-response.dto';

export function toPlayerResponse(player: PlayerWithRel): PlayerResponseDto {
  return {
    id: player.id,
    firstName: player.firstName,
    lastName: player.lastName,
    fullName: `${player.firstName} ${player.lastName}`,
    nationality: player.nationality,
    birthDate: player.birthDate ?? undefined,
    height: player.height ?? undefined,
    weight: player.weight ?? undefined,
    photo: player.photo ?? undefined,
    birthPlace: player.birthPlace ?? undefined,
    birthCountry: player.birthCountry ?? undefined,
    isFree: player.isFree,
    teamId: player.teamId,
    teamName: player.team.name,
    teamLogo: player.team.logo ?? undefined,
    positionId: player.positionId ?? undefined,
    positionName: player.position?.nameEn ?? undefined,
  };
}
