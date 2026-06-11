import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TeamResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiPropertyOptional({ description: 'Ham Türkçe ad (admin panel için)' })
  nameTr?: string;
  @ApiPropertyOptional() logo?: string;
  @ApiProperty() leagueId: string;
  @ApiProperty() leagueName: string;
  @ApiProperty() playerCount: number;
}
