import { ApiProperty } from '@nestjs/swagger';

export class CurrencyRateResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'EUR' }) currencyCode: string;
  @ApiProperty({ example: 'TRY' }) baseCurrencyCode: string;
  @ApiProperty({ example: 35.42 }) rate: number;
  @ApiProperty({ type: String, format: 'date-time' }) rateDate: Date;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt: Date;
}
