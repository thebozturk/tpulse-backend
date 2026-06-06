import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TeamTransferLineDto } from '../../transfers/dto/team-transfer-line.dto';

export class SquadPlayerDto {
  @ApiProperty() id: string;
  @ApiProperty() fullName: string;
  @ApiPropertyOptional() photo?: string;
  @ApiPropertyOptional() positionName?: string;
  @ApiProperty() nationality: string;
  @ApiProperty() isFree: boolean;
}

export class TeamDetailDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiPropertyOptional() logo?: string;
  @ApiPropertyOptional() founded?: number;
  @ApiPropertyOptional() venueName?: string;
  @ApiPropertyOptional() venueCity?: string;
  @ApiPropertyOptional() venueCapacity?: number;
  @ApiProperty() leagueId: string;
  @ApiProperty() leagueName: string;
  @ApiPropertyOptional() leagueLogo?: string;
  @ApiProperty() playerCount: number;
  @ApiProperty({ type: [SquadPlayerDto] }) squad: SquadPlayerDto[];
  @ApiProperty({ type: [TeamTransferLineDto] })
  recentIncoming: TeamTransferLineDto[];
  @ApiProperty({ type: [TeamTransferLineDto] })
  recentOutgoing: TeamTransferLineDto[];
}
