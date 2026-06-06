import { ApiProperty } from '@nestjs/swagger';

/** `POST /auth/refresh` dönüş tipi: token rotation (user field'ı YOK). */
export class RefreshResponseDto {
  @ApiProperty({ description: 'Yeni access token' }) accessToken: string;
  @ApiProperty({ description: 'Yeni refresh token (rotation)' })
  refreshToken: string;
  @ApiProperty({ description: 'Access token sona erme zamanı' })
  expiresAt: Date;
}
