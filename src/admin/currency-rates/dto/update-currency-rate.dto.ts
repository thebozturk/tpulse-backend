import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive } from 'class-validator';

/** Birincil anahtar (currencyCode/baseCurrencyCode/rateDate) değişmez; sadece kur güncellenir. */
export class UpdateCurrencyRateDto {
  @ApiProperty({ example: 35.9, description: 'Pozitif kur değeri' })
  @IsNumber({ maxDecimalPlaces: 8 })
  @IsPositive()
  rate: number;
}
