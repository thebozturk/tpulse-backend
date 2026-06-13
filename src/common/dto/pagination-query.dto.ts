import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Ortak sayfalama query DTO'su. docs/02: pageSize çoğu uçta ≤100 clamp.
 * Diğer feature filter DTO'ları bunu extend edebilir.
 */
export class PaginationQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;
}

/**
 * Sayfalama + sıralamayı birlikte taşıyan ortak DTO.
 * `sort`: "field" (asc) veya "-field" (desc). İzin verilen alanlar repo'da
 * whitelist'lenir; geçersiz alan default sıralamaya düşer.
 */
export class PagedSortQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'field veya -field (örn. -feeAmount)' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  sort?: string;
}
