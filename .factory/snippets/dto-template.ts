// Template: DTO
// Kullanım: src/modules/<feature>/dto/<name>.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail, IsString, IsEnum, IsOptional, IsBoolean, IsInt, IsArray,
  MinLength, MaxLength, Min, Max, ValidateNested, ArrayMaxSize,
  Matches,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateXxxDto {
  @ApiProperty({
    example: 'alice@acme.com',
    description: 'Email address (lowercase, trimmed)',
    maxLength: 255,
  })
  @IsEmail()
  @MaxLength(255)
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @ApiProperty({
    example: 'SecurePass123!',
    description: 'Password (8-72 chars)',
    minLength: 8,
    maxLength: 72,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @ApiProperty({ example: 'Alice Smith', maxLength: 100 })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  name: string;

  @ApiPropertyOptional({ enum: ['user', 'admin'], default: 'user' })
  @IsOptional()
  @IsEnum(['user', 'admin'])
  role?: string;

  @ApiPropertyOptional({ type: [String], maxItems: 10 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  tags?: string[];
}

export class UpdateXxxDto {
  @ApiPropertyOptional({ example: 'Alice Smith', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;
}

export class ListXxxQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Cursor for pagination' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ description: 'Sort: field or -field' })
  @IsOptional()
  @IsString()
  @Matches(/^-?(createdAt|name|email)$/)
  sort?: string = '-createdAt';

  @ApiPropertyOptional({ enum: ['active', 'banned'] })
  @IsOptional()
  @IsEnum(['active', 'banned'])
  status?: string;
}

// Response DTO — password, refreshToken vs. OLMAMALI
export class XxxResponseDto {
  @ApiProperty({ example: '65f7b3a9c1234567890abcde' })
  id: string;

  @ApiProperty({ example: 'alice@acme.com' })
  email: string;

  @ApiProperty({ example: 'Alice Smith' })
  name: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
