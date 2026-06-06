import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * İtibar düzenleme: delta (artımlı) VEYA value (mutlak). İkisi birden ya da hiçbiri
 * gönderilirse service 400 atar (mutual exclusive — bkz. UsersService.updateReputation).
 */
export class AdminUpdateReputationDto {
  @ApiPropertyOptional({
    example: 5,
    description: 'Mevcut itibara eklenecek değer (negatif olabilir)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-100000)
  @Max(100000)
  delta?: number;

  @ApiPropertyOptional({
    example: 100,
    description: 'İtibarı bu mutlak değere ayarla',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000000)
  value?: number;
}
