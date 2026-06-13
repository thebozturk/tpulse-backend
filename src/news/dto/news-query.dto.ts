import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

/**
 * Sayfalama + haber sıralaması. Tüm haber liste uçları bunu extend eder —
 * böylece her uç sortBy/order kabul eder (mobil bunları her isteğe ekliyor).
 */
export class NewsSortQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: ['publishDate', 'title'],
    default: 'publishDate',
  })
  @IsOptional()
  @IsIn(['publishDate', 'title'])
  sortBy: 'publishDate' | 'title' = 'publishDate';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'desc';
}

export class NewsQueryDto extends NewsSortQueryDto {}

export class NewsBySourceDto extends NewsSortQueryDto {
  @ApiPropertyOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  sourceName: string;
}

export class NewsDateRangeDto extends NewsSortQueryDto {
  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @Type(() => Date)
  @IsDate()
  startDate: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @Type(() => Date)
  @IsDate()
  endDate: Date;
}
