import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SearchResultItemDto {
  @ApiProperty({ enum: ['player', 'team', 'league'] })
  type: 'player' | 'team' | 'league';
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiPropertyOptional() imageUrl?: string;
  @ApiPropertyOptional() subtitle?: string;
}

export class SearchResultsDto {
  @ApiProperty({ type: [SearchResultItemDto] }) players: SearchResultItemDto[];
  @ApiProperty({ type: [SearchResultItemDto] }) teams: SearchResultItemDto[];
  @ApiProperty({ type: [SearchResultItemDto] }) leagues: SearchResultItemDto[];
}

export class SearchResponseDto {
  @ApiProperty() query: string;
  @ApiProperty({ type: SearchResultsDto }) data: SearchResultsDto;
}
