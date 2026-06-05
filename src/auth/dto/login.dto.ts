import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'alice@acme.com', maxLength: 256 })
  @IsEmail()
  @MaxLength(256)
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @ApiProperty({ example: 'Secret123', maxLength: 72 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(72)
  password: string;
}
