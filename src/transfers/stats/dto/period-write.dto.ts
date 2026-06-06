import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsString, MaxLength } from 'class-validator';

export class PeriodWriteDto {
  @ApiProperty({ maxLength: 120 }) @IsString() @MaxLength(120) name: string;
  @ApiPropertyOptional({ maxLength: 40 })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  periodType?: string;
  @ApiProperty() @Type(() => Date) @IsDate() startDate: Date;
  @ApiProperty() @Type(() => Date) @IsDate() endDate: Date;
}
