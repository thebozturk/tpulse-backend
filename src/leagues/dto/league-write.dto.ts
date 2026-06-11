import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class LeagueWriteDto {
  @ApiProperty({ maxLength: 30 })
  @IsString()
  @MaxLength(30)
  name: string;

  @ApiPropertyOptional({
    maxLength: 30,
    description: 'Türkçe gösterim adı (boşsa İngilizce `name` gösterilir)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  nameTr?: string;

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

// Swagger şema-adı çakışmasını önlemek için common ImageUrlDto'dan ayrı isim.
export class LeagueImageUrlDto {
  @ApiProperty({ description: 'İndirilecek görsel URL (SSRF korumalı)' })
  @IsString()
  imageUrl: string;
}
