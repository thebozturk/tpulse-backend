import { TransferWithRel } from './transfer.repository';
import { TransferResponseDto } from './dto/transfer-response.dto';
import { TeamTransferLineDto } from './dto/team-transfer-line.dto';
import { DEFAULT_LANG, Lang, pickName } from '../common/i18n/lang';

const fee = (d: TransferWithRel['feeAmount']): number => Number(d);

export function toTransferResponse(
  t: TransferWithRel,
  lang: Lang = DEFAULT_LANG,
): TransferResponseDto {
  return {
    id: t.id,
    player: {
      id: t.player.id,
      name: `${pickName(lang, t.player.firstName, t.player.firstNameTr)} ${pickName(lang, t.player.lastName, t.player.lastNameTr)}`,
      photo: t.player.photo ?? undefined,
      nationality: t.player.nationality,
      positionName: t.player.position?.nameEn ?? undefined,
      teamId: t.player.teamId,
      teamName: pickName(lang, t.player.team.name, t.player.team.nameTr),
    },
    fromTeam: {
      id: t.fromTeam.id,
      name: pickName(lang, t.fromTeam.name, t.fromTeam.nameTr),
      logo: t.fromTeam.logo ?? undefined,
    },
    toTeam: {
      id: t.toTeam.id,
      name: pickName(lang, t.toTeam.name, t.toTeam.nameTr),
      logo: t.toTeam.logo ?? undefined,
    },
    feeAmount: fee(t.feeAmount),
    feeCurrency: t.feeCurrency,
    transferDate: t.transferDate,
    createdBy: t.createdByUser
      ? {
          id: t.createdByUser.id,
          username: t.createdByUser.username,
          photo: t.createdByUser.profilePic ?? undefined,
          role: t.createdByUser.role,
        }
      : undefined,
    isRumour: t.isRumour,
    source: t.source,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt ?? undefined,
  };
}

export function toTeamTransferLine(
  t: TransferWithRel,
  lang: Lang = DEFAULT_LANG,
): TeamTransferLineDto {
  return {
    transferId: t.id,
    playerId: t.playerId,
    playerName: `${pickName(lang, t.player.firstName, t.player.firstNameTr)} ${pickName(lang, t.player.lastName, t.player.lastNameTr)}`,
    playerNationality: t.player.nationality,
    playerPhoto: t.player.photo ?? undefined,
    fromTeamId: t.fromTeamId,
    fromTeamName: pickName(lang, t.fromTeam.name, t.fromTeam.nameTr),
    fromTeamLogo: t.fromTeam.logo ?? undefined,
    toTeamId: t.toTeamId,
    toTeamName: pickName(lang, t.toTeam.name, t.toTeam.nameTr),
    toTeamLogo: t.toTeam.logo ?? undefined,
    transferDate: t.transferDate,
    feeAmount: fee(t.feeAmount),
    feeCurrency: t.feeCurrency,
    createdAt: t.createdAt,
  };
}
