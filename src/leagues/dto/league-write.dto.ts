import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class LeagueWriteDto {
  @ApiProperty({ maxLength: 30 })
  @IsString()
  @MaxLength(30)
  name: string;

  @ApiProperty({ maxLength: 30 })
  @IsString()
  @MaxLength(30)
  country: string;

  @ApiProperty()
  @IsString()
  countryLogo: string;

  @ApiProperty()
  @IsString()
  leagueLogo: string;

  @ApiPropertyOptional({ maxLength: 10 })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  leagueCode?: string;
}

export class ImageUrlDto {
  @ApiProperty({ description: 'İndirilecek görsel URL (SSRF korumalı)' })
  @IsString()
  imageUrl: string;
}
