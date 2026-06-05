import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleAuthDto {
  @ApiProperty({ description: 'Google ID token (client-side oturumdan)' })
  @IsString()
  @IsNotEmpty()
  idToken: string;
}
