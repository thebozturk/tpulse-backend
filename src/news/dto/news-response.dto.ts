import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NewsResponseDto {
  @ApiProperty() newsId: string;
  @ApiProperty() publishDate: Date;
  @ApiPropertyOptional() playerId?: string;
  @ApiPropertyOptional() playerName?: string;
  @ApiPropertyOptional() playerNationality?: string;
  @ApiPropertyOptional() playerPhoto?: string;
  @ApiPropertyOptional() fromTeamId?: string;
  @ApiPropertyOptional() fromTeamName?: string;
  @ApiPropertyOptional() fromTeamLogo?: string;
  @ApiPropertyOptional() toTeamId?: string;
  @ApiPropertyOptional() toTeamName?: string;
  @ApiPropertyOptional() toTeamLogo?: string;
  @ApiProperty() slug: string;
  @ApiPropertyOptional() imageUrl?: string;
  @ApiPropertyOptional() sourceName?: string;
  @ApiPropertyOptional() sourceUrl?: string;
  @ApiProperty() title: string;
  @ApiPropertyOptional() content?: string;
}
