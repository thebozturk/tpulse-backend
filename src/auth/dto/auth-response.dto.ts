import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from '../../users/dto/user-response.dto';

/** docs/03 AuthResponseDto. refreshToken = opaque ham token (DB'de hash'li). */
export class AuthResponseDto {
  @ApiProperty() accessToken: string;
  @ApiProperty() refreshToken: string;
  @ApiProperty({ description: 'Access token sona erme zamanı' })
  expiresAt: Date;
  @ApiProperty({ type: UserResponseDto }) user: UserResponseDto;
}
