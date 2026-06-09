import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({ example: 'alice@acme.com', maxLength: 256 })
  @IsEmail()
  @MaxLength(256)
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @ApiProperty({ description: 'E-posta ile gelen ham doğrulama tokenı' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  token: string;
}
