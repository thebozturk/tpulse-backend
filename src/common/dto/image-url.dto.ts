import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

/** Görsel from-url uçları için ortak DTO (SSRF korumalı downloader işler). */
export class ImageUrlDto {
  @ApiProperty({ description: 'İndirilecek görsel URL' })
  @IsString()
  @MaxLength(2048)
  imageUrl: string;
}
