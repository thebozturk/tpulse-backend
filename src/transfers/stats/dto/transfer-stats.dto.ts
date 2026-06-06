import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TeamTransferLineDto } from '../../dto/team-transfer-line.dto';

export class TeamActivityDto {
  @ApiProperty() teamId: string;
  @ApiProperty() teamName: string;
  @ApiProperty() count: number;
}

export class PlayerActivityDto {
  @ApiProperty() playerId: string;
  @ApiProperty() playerName: string;
  @ApiProperty() count: number;
}

export class HighestFeePlayerDto {
  @ApiProperty() playerId: string;
  @ApiProperty() playerName: string;
  @ApiProperty() feeAmount: number;
}

export class TransferStatsDto {
  @ApiProperty() totalTransfers: number;
  @ApiProperty() totalSpent: number;
  @ApiProperty() averageFee: number;
  @ApiProperty() maxFee: number;
  @ApiProperty() minFee: number;
  @ApiPropertyOptional({ type: TeamTransferLineDto })
  mostExpensiveTransfer?: TeamTransferLineDto;
  @ApiPropertyOptional({ type: TeamTransferLineDto })
  latestTransfer?: TeamTransferLineDto;
  @ApiPropertyOptional({ type: TeamTransferLineDto })
  earliestTransfer?: TeamTransferLineDto;
  @ApiPropertyOptional({ type: TeamActivityDto })
  mostActiveBuyerTeam?: TeamActivityDto;
  @ApiPropertyOptional({ type: TeamActivityDto })
  mostActiveSellerTeam?: TeamActivityDto;
  @ApiPropertyOptional({ type: PlayerActivityDto })
  mostTransferredPlayer?: PlayerActivityDto;
  @ApiPropertyOptional({ type: HighestFeePlayerDto })
  highestFeePlayer?: HighestFeePlayerDto;
}
