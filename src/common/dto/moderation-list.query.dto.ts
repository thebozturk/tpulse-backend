import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from './pagination-query.dto';

/** Moderasyon listeleri için ortak filtre: ownerId + q + sayfalama. */
export class ModerationListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'İçerik sahibi kullanıcı',
  })
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @ApiPropertyOptional({
    maxLength: 100,
    description: 'İçerik araması (ILIKE)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}
