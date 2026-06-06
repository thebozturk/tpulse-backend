import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ example: 'alice@acme.com', maxLength: 256 })
  @IsEmail()
  @MaxLength(256)
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @ApiProperty({ description: 'E-posta ile gelen ham reset token' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  token: string;

  @ApiProperty({ example: 'NewSecret123', minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/[A-Z]/, { message: 'Parola en az bir büyük harf içermeli.' })
  @Matches(/[a-z]/, { message: 'Parola en az bir küçük harf içermeli.' })
  @Matches(/[0-9]/, { message: 'Parola en az bir rakam içermeli.' })
  newPassword: string;
}
