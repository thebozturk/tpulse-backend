import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class PlayerWriteDto {
  @ApiProperty({ maxLength: 32 }) @IsString() @MaxLength(32) firstName: string;
  @ApiProperty({ maxLength: 32 }) @IsString() @MaxLength(32) lastName: string;
  @ApiProperty({ maxLength: 32 })
  @IsString()
  @MaxLength(32)
  nationality: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  birthDate?: Date;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(300)
  height?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(300)
  weight?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() photo?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  birthPlace?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  birthCountry?: string;

  @ApiProperty({ default: false }) @IsBoolean() isFree: boolean = false;
  @ApiProperty() @IsUUID() teamId: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() positionId?: string;
}
