import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'alice', minLength: 3, maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(50)
  @Transform(({ value }) => value?.trim())
  username: string;

  @ApiProperty({ example: 'alice@acme.com', maxLength: 256 })
  @IsEmail()
  @MaxLength(256)
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @ApiProperty({ example: 'Secret123', minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/[A-Z]/, { message: 'Parola en az bir büyük harf içermeli.' })
  @Matches(/[a-z]/, { message: 'Parola en az bir küçük harf içermeli.' })
  @Matches(/[0-9]/, { message: 'Parola en az bir rakam içermeli.' })
  password: string;

  @ApiProperty({ example: 'Alice', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Transform(({ value }) => value?.trim())
  nickname: string;

  @ApiPropertyOptional({ example: 'Arsenal', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  favouriteTeam?: string;
}
