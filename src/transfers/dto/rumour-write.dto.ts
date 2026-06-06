import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateRumourDto {
  @ApiProperty() @IsUUID() playerId: string;
  @ApiProperty() @IsUUID() fromTeamId: string;
  @ApiProperty() @IsUUID() toTeamId: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  feeAmount?: number;
  @ApiPropertyOptional({ maxLength: 10 })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  feeCurrency?: string;
}

export class ConfirmRumourDto {
  @ApiProperty() @Type(() => Number) @IsNumber() @Min(0) feeAmount: number;
  @ApiProperty({ maxLength: 10 })
  @IsString()
  @MaxLength(10)
  feeCurrency: string;
  @ApiProperty() @Type(() => Date) @IsDate() transferDate: Date;
}
