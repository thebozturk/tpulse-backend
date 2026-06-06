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

export class NewsQueryDto extends PaginationQueryDto {
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

export class NewsBySourceDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  sourceName: string;
}

export class NewsDateRangeDto extends PaginationQueryDto {
  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @Type(() => Date)
  @IsDate()
  startDate: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @Type(() => Date)
  @IsDate()
  endDate: Date;
}
