import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, MaxLength } from 'class-validator';

export class ResendVerificationDto {
  @ApiProperty({ example: 'alice@acme.com', maxLength: 256 })
  @IsEmail()
  @MaxLength(256)
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;
}
