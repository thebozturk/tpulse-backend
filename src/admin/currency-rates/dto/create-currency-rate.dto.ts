import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsNumber,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateCurrencyRateDto {
  @ApiProperty({ maxLength: 10, example: 'EUR' })
  @IsString()
  @MaxLength(10)
  currencyCode: string;

  @ApiProperty({ maxLength: 10, example: 'TRY' })
  @IsString()
  @MaxLength(10)
  baseCurrencyCode: string;

  @ApiProperty({ example: 35.42, description: 'Pozitif kur değeri' })
  @IsNumber({ maxDecimalPlaces: 8 })
  @IsPositive()
  rate: number;

  @ApiProperty({ type: String, format: 'date-time' })
  @Type(() => Date)
  @IsDate()
  rateDate: Date;
}
