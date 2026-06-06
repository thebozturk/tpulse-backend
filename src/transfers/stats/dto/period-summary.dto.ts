import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TeamTransferLineDto } from '../../dto/team-transfer-line.dto';

export class TransferPeriodSummaryDto {
  @ApiPropertyOptional() periodName?: string;
  @ApiPropertyOptional() year?: number;
  @ApiPropertyOptional() startDate?: Date;
  @ApiPropertyOptional() endDate?: Date;
  @ApiProperty() baseCurrency: string;
  @ApiProperty() totalTransfers: number;
  @ApiProperty({ description: 'baseCurrency cinsinden toplam harcama' })
  totalSpent: number;
  @ApiProperty({ type: [TeamTransferLineDto] })
  topTransfers: TeamTransferLineDto[];
}
