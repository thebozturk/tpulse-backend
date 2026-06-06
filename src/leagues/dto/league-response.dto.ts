import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LeagueResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() country: string;
  @ApiProperty() countryLogo: string;
  @ApiProperty() leagueLogo: string;
  @ApiPropertyOptional() leagueCode?: string;
  @ApiProperty() teamCount: number;
}
