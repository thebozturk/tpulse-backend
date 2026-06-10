import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

/**
 * "Senin İçin" feed query'si: sayfalama + opsiyonel client-sent seenIds
 * (virgülle ayrılmış post id'leri — bu istekte zaten görülenler elenecek).
 */
export class FeedQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: "Client tarafında zaten görülen post id'leri (virgülle).",
    example: '7c9e6679-7425-40de-944b-e07fc1f90ae7,9b2d...',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : value,
  )
  @IsArray()
  @IsUUID('4', { each: true })
  seenIds?: string[];
}
