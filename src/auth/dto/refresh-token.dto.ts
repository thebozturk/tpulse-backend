import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Opaque refresh token (login/refresh yanıtından)',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  refreshToken: string;
}
