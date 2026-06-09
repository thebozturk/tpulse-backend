import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UnsubscribeDto {
  @ApiProperty({
    description: 'E-posta footer linkindeki imzalı abonelik tokenı',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  token: string;
}
