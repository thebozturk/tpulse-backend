import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LeagueTeamDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiPropertyOptional() nameTr?: string;
  @ApiPropertyOptional() logo?: string;
  @ApiProperty() playerCount: number;
}

export class LeagueResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiPropertyOptional({ description: 'Ham Türkçe ad (admin panel için)' })
  nameTr?: string;
  @ApiProperty() country: string;
  @ApiPropertyOptional({ description: 'Uluslararası kupalarda null olabilir' })
  countryLogo?: string;
  @ApiProperty() leagueLogo: string;
  @ApiPropertyOptional() leagueCode?: string;
  @ApiProperty() teamCount: number;
  @ApiPropertyOptional({
    type: [LeagueTeamDto],
    description: 'Lige bağlı takımlar — yalnız tekil lig GET’inde',
  })
  teams?: LeagueTeamDto[];
}
