import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TransferPeriodDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiPropertyOptional() periodType?: string;
  @ApiProperty() startDate: Date;
  @ApiProperty() endDate: Date;
}
