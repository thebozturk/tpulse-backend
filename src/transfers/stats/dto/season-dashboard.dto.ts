import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TeamTransferLineDto } from '../../dto/team-transfer-line.dto';

export class TopSpenderDto {
  @ApiProperty() teamId: string;
  @ApiProperty() teamName: string;
  @ApiProperty() total: number;
}

export class TransferSeasonDashboardDto {
  @ApiProperty() baseCurrency: string;
  @ApiPropertyOptional() year?: number;
  @ApiPropertyOptional() periodName?: string;
  @ApiProperty() totalTransfers: number;
  @ApiProperty() totalSpent: number;
  @ApiProperty() topN: number;
  @ApiProperty({ type: [TeamTransferLineDto] })
  topTransfers: TeamTransferLineDto[];
  @ApiProperty({ type: [TopSpenderDto] })
  topSpenders: TopSpenderDto[];
}
