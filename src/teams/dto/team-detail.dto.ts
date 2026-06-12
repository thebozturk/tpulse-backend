import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TeamTransferLineDto } from '../../transfers/dto/team-transfer-line.dto';

/** Kadro oyuncusunun bu takım liginde o sezonki özet istatistiği. */
export class SquadPlayerStatsDto {
  @ApiProperty() season: number;
  @ApiPropertyOptional() appearances?: number;
  @ApiPropertyOptional() minutes?: number;
  @ApiPropertyOptional() goals?: number;
  @ApiPropertyOptional() assists?: number;
  @ApiPropertyOptional() rating?: number;
  @ApiPropertyOptional() yellowCards?: number;
  @ApiPropertyOptional() redCards?: number;
}

export class SquadPlayerDto {
  @ApiProperty() id: string;
  @ApiProperty() fullName: string;
  @ApiPropertyOptional() photo?: string;
  @ApiPropertyOptional() positionName?: string;
  @ApiProperty() nationality: string;
  @ApiProperty() isFree: boolean;
  @ApiPropertyOptional() birthDate?: Date;
  @ApiPropertyOptional() height?: number;
  @ApiPropertyOptional() weight?: number;
  @ApiPropertyOptional({
    type: SquadPlayerStatsDto,
    description: 'Bu lig sezonundaki özet (varsa)',
  })
  stats?: SquadPlayerStatsDto;
}

/** Takımın bu ligdeki kadro-toplamı (oyuncu stat'larının sezona göre özeti). */
export class TeamSeasonTotalsDto {
  @ApiPropertyOptional() season?: number;
  @ApiProperty() goals: number;
  @ApiProperty() assists: number;
  @ApiProperty() yellowCards: number;
  @ApiProperty() redCards: number;
  @ApiProperty({ description: 'Stat satırı olan oyuncu sayısı' })
  playersWithStats: number;
}

export class TeamDetailDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiPropertyOptional({ description: 'Ham Türkçe ad (admin panel için)' })
  nameTr?: string;
  @ApiPropertyOptional() logo?: string;
  @ApiPropertyOptional() founded?: number;
  @ApiPropertyOptional() venueName?: string;
  @ApiPropertyOptional() venueCity?: string;
  @ApiPropertyOptional() venueCapacity?: number;
  @ApiProperty() leagueId: string;
  @ApiProperty() leagueName: string;
  @ApiPropertyOptional() leagueLogo?: string;
  @ApiProperty() playerCount: number;
  @ApiPropertyOptional({
    type: TeamSeasonTotalsDto,
    description: 'Kadronun bu ligdeki güncel sezon toplamı',
  })
  seasonTotals?: TeamSeasonTotalsDto;
  @ApiProperty({ type: [SquadPlayerDto] }) squad: SquadPlayerDto[];
  @ApiProperty({ type: [TeamTransferLineDto] })
  recentIncoming: TeamTransferLineDto[];
  @ApiProperty({ type: [TeamTransferLineDto] })
  recentOutgoing: TeamTransferLineDto[];
}
