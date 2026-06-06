import { TransferWithRel } from './transfer.repository';
import { TransferResponseDto } from './dto/transfer-response.dto';
import { TeamTransferLineDto } from './dto/team-transfer-line.dto';

const fee = (d: TransferWithRel['feeAmount']): number => Number(d);

export function toTransferResponse(t: TransferWithRel): TransferResponseDto {
  return {
    id: t.id,
    player: {
      id: t.player.id,
      name: `${t.player.firstName} ${t.player.lastName}`,
      photo: t.player.photo ?? undefined,
      nationality: t.player.nationality,
      positionName: t.player.position?.nameEn ?? undefined,
      teamId: t.player.teamId,
      teamName: t.player.team.name,
    },
    fromTeam: {
      id: t.fromTeam.id,
      name: t.fromTeam.name,
      logo: t.fromTeam.logo ?? undefined,
    },
    toTeam: {
      id: t.toTeam.id,
      name: t.toTeam.name,
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

export function toTeamTransferLine(t: TransferWithRel): TeamTransferLineDto {
  return {
    transferId: t.id,
    playerId: t.playerId,
    playerName: `${t.player.firstName} ${t.player.lastName}`,
    playerPhoto: t.player.photo ?? undefined,
    fromTeamId: t.fromTeamId,
    fromTeamName: t.fromTeam.name,
    fromTeamLogo: t.fromTeam.logo ?? undefined,
    toTeamId: t.toTeamId,
    toTeamName: t.toTeam.name,
    toTeamLogo: t.toTeam.logo ?? undefined,
    transferDate: t.transferDate,
    feeAmount: fee(t.feeAmount),
    feeCurrency: t.feeCurrency,
    createdAt: t.createdAt,
  };
}
