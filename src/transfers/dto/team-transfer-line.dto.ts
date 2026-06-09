import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Leaner transfer satırı — team/player/league transfer listeleri için (docs/03). */
export class TeamTransferLineDto {
  @ApiProperty() transferId: string;
  @ApiProperty() playerId: string;
  @ApiProperty() playerName: string;
  /** Oyuncu uyruğu — /api/transfers/latest ile birebir aynı kaynak (player.nationality). */
  @ApiProperty() playerNationality: string;
  @ApiPropertyOptional() playerPhoto?: string;
  @ApiProperty() fromTeamId: string;
  @ApiPropertyOptional() fromTeamName?: string;
  @ApiPropertyOptional() fromTeamLogo?: string;
  @ApiProperty() toTeamId: string;
  @ApiPropertyOptional() toTeamName?: string;
  @ApiPropertyOptional() toTeamLogo?: string;
  @ApiProperty() transferDate: Date;
  @ApiProperty() feeAmount: number;
  @ApiProperty() feeCurrency: string;
  @ApiProperty() createdAt: Date;
}
