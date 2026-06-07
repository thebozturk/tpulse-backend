import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import {
  BOT_CONTENT_CATEGORY_KEYS,
  BotContentCategoryKey,
} from '../../common/enums/bot-content-category.enum';

export class IngestPostDto {
  @ApiProperty({ enum: BOT_CONTENT_CATEGORY_KEYS, example: 'Rumour' })
  @IsIn(BOT_CONTENT_CATEGORY_KEYS)
  category: BotContentCategoryKey;

  @ApiProperty({
    maxLength: 2000,
    example: 'Son dakika: ... transferi gerçekleşti.',
  })
  @IsString()
  @MaxLength(2000)
  text: string;

  @ApiProperty({
    maxLength: 64,
    description: 'Tweet id — idempotency anahtarı',
  })
  @IsString()
  @MaxLength(64)
  sourceId: string;

  @ApiPropertyOptional({
    maxLength: 500,
    example: 'https://x.com/.../status/123',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  sourceUrl?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  playerId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  teamId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  fromTeamId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  toTeamId?: string;
}
