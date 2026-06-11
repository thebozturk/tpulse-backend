import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LeagueResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiPropertyOptional({ description: 'Ham Türkçe ad (admin panel için)' })
  nameTr?: string;
  @ApiProperty() country: string;
  @ApiProperty() countryLogo: string;
  @ApiProperty() leagueLogo: string;
  @ApiPropertyOptional() leagueCode?: string;
  @ApiProperty() teamCount: number;
}
