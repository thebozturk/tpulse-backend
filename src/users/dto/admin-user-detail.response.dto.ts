import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserResponseDto } from './user-response.dto';

/** Admin kullanıcı detayı — UserResponseDto + moderasyon alanları. */
export class AdminUserDetailResponseDto extends UserResponseDto {
  @ApiPropertyOptional({ type: String, format: 'date-time' })
  bannedAt?: Date;

  @ApiPropertyOptional()
  banReason?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  updatedAt?: Date;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description: 'Doğrulama rozetinin verildiği an',
  })
  verifiedAt?: Date;
}
