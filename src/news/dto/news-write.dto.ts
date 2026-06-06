import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDate,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateNewsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  publishDate?: Date;
  @ApiPropertyOptional() @IsOptional() @IsUUID() playerId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() fromTeamId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() toTeamId?: string;
  @ApiProperty({ maxLength: 256 }) @IsString() @MaxLength(256) slug: string;
  @ApiPropertyOptional() @IsOptional() @IsString() imageUrl?: string;
  @ApiPropertyOptional({ maxLength: 128 })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  sourceName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() sourceUrl?: string;
  @ApiProperty() @IsString() @MaxLength(500) title: string;
  @ApiPropertyOptional() @IsOptional() @IsString() content?: string;
}

export class UpdateNewsDto extends CreateNewsDto {
  @ApiProperty({ description: 'Route :newsId ile eslesemeli (uyusmazsa 400)' })
  @IsUUID()
  newsId: string;
}

export class BulkDeleteNewsDto {
  @ApiProperty({ type: [String], maxItems: 100 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  ids: string[];
}

/** POST /api/admin/news => { data: { newsId } } */
export class NewsIdResponseDto {
  @ApiProperty({ example: 'uuid-v4', description: 'Olusturulan haberin IDsi' })
  newsId: string;
}

/** DELETE /api/admin/news/bulk => { data: { deletedCount } } */
export class DeletedCountResponseDto {
  @ApiProperty({ example: 5, description: 'Silinen haber sayisi' })
  deletedCount: number;
}
