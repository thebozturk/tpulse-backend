import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TransferPlayerDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  // fullName: /api/players ile aynı konvansiyon. Mobil istemci nested player'da
  // önce fullName okuyor (name korunur — panel t.player.name kullanır).
  @ApiProperty() fullName: string;
  @ApiPropertyOptional() photo?: string;
  @ApiProperty() nationality: string;
  @ApiPropertyOptional() positionName?: string;
  @ApiProperty() teamId: string;
  @ApiProperty() teamName: string;
}

export class TransferTeamDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiPropertyOptional() logo?: string;
}

export class TransferCreatedByDto {
  @ApiProperty() id: string;
  @ApiProperty() username: string;
  @ApiPropertyOptional() photo?: string;
  @ApiProperty() role: string;
}

/** Zengin transfer/rumour şekli (rumour = isRumour:true). docs/03 RumourDto. */
export class TransferResponseDto {
  @ApiProperty() id: string;
  @ApiProperty({ type: TransferPlayerDto }) player: TransferPlayerDto;
  @ApiProperty({ type: TransferTeamDto }) fromTeam: TransferTeamDto;
  @ApiProperty({ type: TransferTeamDto }) toTeam: TransferTeamDto;
  @ApiProperty() feeAmount: number;
  @ApiProperty() feeCurrency: string;
  @ApiProperty() transferDate: Date;
  @ApiPropertyOptional({ type: TransferCreatedByDto })
  createdBy?: TransferCreatedByDto;
  @ApiProperty() isRumour: boolean;
  @ApiProperty() source: string;
  @ApiProperty() createdAt: Date;
  @ApiPropertyOptional() updatedAt?: Date;
}
