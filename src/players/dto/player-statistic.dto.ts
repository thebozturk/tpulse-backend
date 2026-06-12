import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Oyuncunun bir lig × sezon istatistik satırı. Futbolcu detayında
 * (GET /api/players/:id ve /:id/profile) tüm veriyle döner.
 */
export class PlayerStatisticDto {
  @ApiProperty() season: number;

  @ApiPropertyOptional() leagueId?: string;
  @ApiProperty() leagueExternalId: number;
  @ApiPropertyOptional() leagueName?: string;
  @ApiPropertyOptional() leagueLogo?: string;

  @ApiPropertyOptional() teamId?: string;
  @ApiPropertyOptional() teamName?: string;
  @ApiPropertyOptional() teamLogo?: string;

  @ApiPropertyOptional() appearances?: number;
  @ApiPropertyOptional() lineups?: number;
  @ApiPropertyOptional() minutes?: number;
  @ApiPropertyOptional() rating?: number;
  @ApiProperty() captain: boolean;

  @ApiPropertyOptional() goalsTotal?: number;
  @ApiPropertyOptional() goalsConceded?: number;
  @ApiPropertyOptional() goalsAssists?: number;
  @ApiPropertyOptional() goalsSaves?: number;

  @ApiPropertyOptional() shotsTotal?: number;
  @ApiPropertyOptional() shotsOn?: number;

  @ApiPropertyOptional() passesTotal?: number;
  @ApiPropertyOptional() passesKey?: number;
  @ApiPropertyOptional() passesAccuracy?: number;

  @ApiPropertyOptional() tacklesTotal?: number;
  @ApiPropertyOptional() tacklesBlocks?: number;
  @ApiPropertyOptional() tacklesInterceptions?: number;

  @ApiPropertyOptional() duelsTotal?: number;
  @ApiPropertyOptional() duelsWon?: number;

  @ApiPropertyOptional() dribblesAttempts?: number;
  @ApiPropertyOptional() dribblesSuccess?: number;

  @ApiPropertyOptional() foulsDrawn?: number;
  @ApiPropertyOptional() foulsCommitted?: number;

  @ApiPropertyOptional() cardsYellow?: number;
  @ApiPropertyOptional() cardsYellowRed?: number;
  @ApiPropertyOptional() cardsRed?: number;

  @ApiPropertyOptional() penaltyWon?: number;
  @ApiPropertyOptional() penaltyCommitted?: number;
  @ApiPropertyOptional() penaltyScored?: number;
  @ApiPropertyOptional() penaltyMissed?: number;
  @ApiPropertyOptional() penaltySaved?: number;
}
